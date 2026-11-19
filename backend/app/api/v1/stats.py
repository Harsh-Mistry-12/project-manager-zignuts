import calendar
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.api import deps
from app.models.models import Project, TimeEntry, User
from app.schemas.schemas import ProjectAnnualHeatmap, HeatmapMonth

router = APIRouter()

@router.get("/annual-heatmap/{project_id}", response_model=ProjectAnnualHeatmap)
def get_project_annual_heatmap(
    project_id: int,
    year: Optional[int] = Query(None, description="Target year, defaults to current year"),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Sec 3: Annual Heatmap View per Project to view cap and time logged for all 12 months.
    """
    project = deps.verify_project_access(project_id, current_user, db)
    target_year = year or datetime.utcnow().year
    monthly_cap = float(project.monthly_hourly_cap)

    # Query all entries for this project and year grouped by month
    monthly_query = db.query(
        func.extract('month', TimeEntry.date).label('month_num'),
        func.coalesce(func.sum(TimeEntry.hours), 0.0).label('total_hours')
    ).filter(
        TimeEntry.project_id == project.id,
        TimeEntry.is_deleted == False,
        func.extract('year', TimeEntry.date) == target_year
    ).group_by(func.extract('month', TimeEntry.date)).all()

    logged_by_month = {int(row.month_num): float(row.total_hours) for row in monthly_query}

    heatmap_months = []
    for m in range(1, 13):
        logged = round(logged_by_month.get(m, 0.0), 2)
        pct = round((logged / monthly_cap * 100.0), 1) if monthly_cap > 0 else 0.0

        if pct > 100.0:
            status = "over_cap"
        elif pct >= 90.0:
            status = "warning"
        else:
            status = "normal"

        heatmap_months.append(
            HeatmapMonth(
                month=m,
                year=target_year,
                month_name=calendar.month_name[m],
                logged_hours=logged,
                monthly_cap=monthly_cap,
                percentage=pct,
                status=status
            )
        )

    return ProjectAnnualHeatmap(
        project_id=project.id,
        project_name=project.name,
        client_name=project.client_name,
        year=target_year,
        monthly_hourly_cap=monthly_cap,
        months=heatmap_months
    )

@router.get("/summary")
def get_organization_stats_summary(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["admin", "pm"]))
):
    """Global organization overview metrics."""
    now = datetime.utcnow()
    user_role = current_user.role.role_name if current_user.role else "member"

    if user_role == "admin":
        projects = db.query(Project).all()
    else:
        projects = db.query(Project).filter(
            (Project.created_by == current_user.id) | (Project.assigned_pm_id == current_user.id)
        ).all()

    total_projects = len(projects)
    total_hours_month = 0.0
    warning_count = 0
    over_cap_count = 0

    for p in projects:
        logged = db.query(func.coalesce(func.sum(TimeEntry.hours), 0.0)).filter(
            TimeEntry.project_id == p.id,
            TimeEntry.is_deleted == False,
            func.extract('month', TimeEntry.date) == now.month,
            func.extract('year', TimeEntry.date) == now.year
        ).scalar()
        logged_val = float(logged)
        total_hours_month += logged_val
        cap = float(p.monthly_hourly_cap)
        pct = (logged_val / cap * 100.0) if cap > 0 else 0.0

        if pct > 100.0:
            over_cap_count += 1
        elif pct >= 90.0:
            warning_count += 1

    return {
        "total_projects": total_projects,
        "total_hours_this_month": round(total_hours_month, 2),
        "warning_cap_projects": warning_count,
        "over_cap_projects": over_cap_count,
        "current_month_name": now.strftime("%B %Y")
    }

