from datetime import datetime, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from app.api import deps
from app.models.models import TimeEntry, Project, User, ProjectMember
from app.schemas.schemas import TimeEntryCreate, TimeEntryUpdate, TimeEntryResponse
from app.services.audit_service import log_audit

router = APIRouter()

def build_time_entry_response(entry: TimeEntry) -> TimeEntryResponse:
    return TimeEntryResponse(
        id=entry.id,
        project_id=entry.project_id,
        project_name=entry.project.name if entry.project else "Unknown",
        client_name=entry.project.client_name if entry.project else "Unknown",
        user_id=entry.user_id,
        user_name=entry.user.full_name if entry.user else "Unknown",
        date=entry.date,
        hours=float(entry.hours),
        notes=entry.notes,
        created_at=entry.created_at
    )

@router.get("", response_model=List[TimeEntryResponse])
@router.get("/", response_model=List[TimeEntryResponse])
def get_time_entries(
    project_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """
    RBAC-filtered time entries:
    - Admin: all entries
    - PM: entries for projects managed by PM
    - Member: only their own entries
    """
    # If a specific project is requested, explicitly verify RBAC access
    if project_id is not None:
        deps.verify_project_access(project_id, current_user, db)

    user_role = current_user.role.role_name if current_user.role else "member"
    query = db.query(TimeEntry).filter(TimeEntry.is_deleted == False)

    if user_role == "admin":
        if project_id:
            query = query.filter(TimeEntry.project_id == project_id)
    elif user_role == "pm":
        pm_project_ids = db.query(Project.id).filter(
            (Project.created_by == current_user.id) | (Project.assigned_pm_id == current_user.id)
        ).subquery()
        query = query.filter(TimeEntry.project_id.in_(pm_project_ids))
        if project_id:
            query = query.filter(TimeEntry.project_id == project_id)
    else:  # Member
        query = query.filter(TimeEntry.user_id == current_user.id)
        if project_id:
            query = query.filter(TimeEntry.project_id == project_id)

    if start_date:
        query = query.filter(TimeEntry.date >= start_date)
    if end_date:
        query = query.filter(TimeEntry.date <= end_date)

    entries = query.order_by(TimeEntry.date.desc(), TimeEntry.id.desc()).all()
    return [build_time_entry_response(e) for e in entries]

@router.post("", response_model=TimeEntryResponse)
@router.post("/", response_model=TimeEntryResponse)
def create_time_entry(
    payload: TimeEntryCreate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Log manual time entry (date, hours, notes).
    Backend verifies user is assigned to project.
    """
    deps.verify_project_access(payload.project_id, current_user, db)

    entry = TimeEntry(
        project_id=payload.project_id,
        user_id=current_user.id,
        date=payload.date,
        hours=payload.hours,
        notes=payload.notes.strip() if payload.notes else None,
        updated_by=current_user.id
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    log_audit(
        db=db,
        action="TIME_ENTRY_CREATE",
        entity_type="TimeEntry",
        user_id=current_user.id,
        entity_id=str(entry.id),
        new_values={
            "project_id": entry.project_id,
            "date": entry.date.isoformat(),
            "hours": float(entry.hours),
            "notes": entry.notes
        },
        request=request
    )

    return build_time_entry_response(entry)

@router.delete("/{entry_id}")
def delete_time_entry(
    entry_id: int,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Soft delete time entry:
    - Admin: can delete any entry
    - PM: can delete entries ONLY for projects they manage (or their own entry)
    - Member: can delete ONLY their own time entries
    """
    entry = db.query(TimeEntry).filter(TimeEntry.id == entry_id, TimeEntry.is_deleted == False).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")

    user_role = current_user.role.role_name if current_user.role else "member"
    if user_role == "admin":
        pass  # Admin allowed
    elif user_role == "pm":
        # PM can delete if they manage this project OR if they created the entry
        project = db.query(Project).filter(Project.id == entry.project_id).first()
        is_manager = project and (project.created_by == current_user.id or project.assigned_pm_id == current_user.id)
        if not is_manager and entry.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Forbidden: You cannot delete time entries for projects you do not manage."
            )
    else:  # Member
        if entry.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Forbidden: You can only delete your own time entries."
            )

    entry.is_deleted = True
    entry.deleted_at = datetime.utcnow()
    entry.updated_by = current_user.id
    db.commit()

    log_audit(
        db=db,
        action="TIME_ENTRY_DELETE",
        entity_type="TimeEntry",
        user_id=current_user.id,
        entity_id=str(entry.id),
        request=request
    )

    return {"message": "Time entry successfully deleted"}
