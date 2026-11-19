from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.api import deps
from app.models.models import Project, ProjectMember, TimeEntry, User
from app.schemas.schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    ProjectMemberAssign, ProjectMemberResponse
)
from app.services.audit_service import log_audit

router = APIRouter()

def compute_project_metrics(p: Project, db: Session) -> dict:
    """Calculates current month logged hours, cap percentage, and warning state."""
    now = datetime.utcnow()
    total_current_month = db.query(
        func.coalesce(func.sum(TimeEntry.hours), 0.0)
    ).filter(
        TimeEntry.project_id == p.id,
        TimeEntry.is_deleted == False,
        func.extract('month', TimeEntry.date) == now.month,
        func.extract('year', TimeEntry.date) == now.year
    ).scalar()

    logged = float(total_current_month)
    cap = float(p.monthly_hourly_cap) if p.monthly_hourly_cap else 160.0
    percentage = (logged / cap * 100.0) if cap > 0 else 0.0

    if percentage > 100.0:
        cap_status = "over_cap"
    elif percentage >= 90.0:
        cap_status = "warning"
    else:
        cap_status = "normal"

    assigned_pm_name = p.assigned_pm.full_name if p.assigned_pm else (p.creator.full_name if p.creator else "Unassigned")

    members_list = [
        ProjectMemberResponse(
            id=m.id,
            user_id=m.user.id,
            full_name=m.user.full_name,
            email=m.user.email,
            role_name=m.user.role.role_name if m.user.role else "member",
            assigned_at=m.assigned_at
        )
        for m in p.members if m.user and not m.user.is_deleted
    ]

    return {
        "id": p.id,
        "name": p.name,
        "client_name": p.client_name,
        "monthly_hourly_cap": cap,
        "budget": float(p.budget) if p.budget else None,
        "created_by": p.created_by,
        "assigned_pm_id": p.assigned_pm_id,
        "assigned_pm_name": assigned_pm_name,
        "created_at": p.created_at,
        "current_month_hours": round(logged, 2),
        "cap_percentage": round(percentage, 1),
        "cap_status": cap_status,
        "assigned_members_count": len(members_list),
        "members": members_list
    }

@router.get("", response_model=List[ProjectResponse])
@router.get("/", response_model=List[ProjectResponse])
def get_projects(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """
    RBAC-enforced project list:
    - Admin: all projects
    - PM: created by or assigned to PM
    - Member: projects assigned to user
    """
    user_role = current_user.role.role_name if current_user.role else "member"

    if user_role == "admin":
        projects = db.query(Project).order_by(Project.created_at.desc()).all()
    elif user_role == "pm":
        projects = db.query(Project).filter(
            (Project.created_by == current_user.id) | (Project.assigned_pm_id == current_user.id)
        ).order_by(Project.created_at.desc()).all()
    else:  # Member
        assigned_ids = db.query(ProjectMember.project_id).filter(
            ProjectMember.user_id == current_user.id
        ).subquery()
        projects = db.query(Project).filter(Project.id.in_(assigned_ids)).order_by(Project.name.asc()).all()

    return [ProjectResponse(**compute_project_metrics(p, db)) for p in projects]

@router.post("", response_model=ProjectResponse)
@router.post("/", response_model=ProjectResponse)
def create_project(
    payload: ProjectCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["admin", "pm"]))
):
    """PM or Admin creates a new retainer project with monthly hour cap."""
    assigned_pm = payload.assigned_pm_id if payload.assigned_pm_id else current_user.id

    new_project = Project(
        name=payload.name.strip(),
        client_name=payload.client_name.strip(),
        monthly_hourly_cap=payload.monthly_hourly_cap,
        budget=payload.budget,
        created_by=current_user.id,
        assigned_pm_id=assigned_pm
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    log_audit(
        db=db,
        action="PROJECT_CREATE",
        entity_type="Project",
        user_id=current_user.id,
        entity_id=str(new_project.id),
        new_values={
            "name": new_project.name,
            "client": new_project.client_name,
            "monthly_hourly_cap": float(new_project.monthly_hourly_cap)
        },
        request=request
    )

    return ProjectResponse(**compute_project_metrics(new_project, db))

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project_details(
    project_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Sec 2: View project details and assigned members (RBAC-enforced)."""
    project = deps.verify_project_access(project_id, current_user, db)
    return ProjectResponse(**compute_project_metrics(project, db))

@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["admin", "pm"]))
):
    """Update project cap, name, or assigned PM."""
    project = deps.verify_project_access(project_id, current_user, db)

    old_values = {
        "name": project.name,
        "monthly_hourly_cap": float(project.monthly_hourly_cap)
    }

    if payload.name is not None:
        project.name = payload.name.strip()
    if payload.client_name is not None:
        project.client_name = payload.client_name.strip()
    if payload.monthly_hourly_cap is not None:
        project.monthly_hourly_cap = payload.monthly_hourly_cap
    if payload.budget is not None:
        project.budget = payload.budget
    if payload.assigned_pm_id is not None:
        project.assigned_pm_id = payload.assigned_pm_id

    db.commit()
    db.refresh(project)

    log_audit(
        db=db,
        action="PROJECT_UPDATE",
        entity_type="Project",
        user_id=current_user.id,
        entity_id=str(project.id),
        old_values=old_values,
        new_values={
            "name": project.name,
            "monthly_hourly_cap": float(project.monthly_hourly_cap)
        },
        request=request
    )

    return ProjectResponse(**compute_project_metrics(project, db))

@router.post("/{project_id}/members", response_model=ProjectResponse)
def assign_members_to_project(
    project_id: int,
    payload: ProjectMemberAssign,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["admin", "pm"]))
):
    """Sec 4: PM or Admin assigns members to a managed project."""
    project = deps.verify_project_access(project_id, current_user, db)

    # Clear existing members and reassign
    db.query(ProjectMember).filter(ProjectMember.project_id == project.id).delete()

    for uid in payload.user_ids:
        user = db.query(User).filter(
            User.id == uid,
            User.is_deleted == False,
            User.is_active == True
        ).first()
        if user:
            assignment = ProjectMember(project_id=project.id, user_id=user.id)
            db.add(assignment)

    db.commit()
    db.refresh(project)

    log_audit(
        db=db,
        action="PROJECT_ASSIGN_MEMBERS",
        entity_type="Project",
        user_id=current_user.id,
        entity_id=str(project.id),
        new_values={"user_ids": payload.user_ids},
        request=request
    )

    return ProjectResponse(**compute_project_metrics(project, db))
