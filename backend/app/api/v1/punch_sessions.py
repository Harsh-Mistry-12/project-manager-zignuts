from datetime import datetime, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.api import deps
from app.models.models import PunchSession, TimeEntry, Project, User, ProjectMember
from app.schemas.schemas import (
    PunchInRequest, PunchOutRequest, PunchSessionResponse, DailyPunchSummary
)
from app.services.audit_service import log_audit

router = APIRouter()

def build_punch_response(session: PunchSession) -> PunchSessionResponse:
    duration_hrs = 0.0
    if session.end_time and session.start_time:
        delta = session.end_time - session.start_time
        duration_hrs = round(delta.total_seconds() / 3600.0, 2)
    elif session.start_time:
        # Live duration
        delta = datetime.utcnow() - session.start_time
        duration_hrs = round(delta.total_seconds() / 3600.0, 2)

    return PunchSessionResponse(
        id=session.id,
        user_id=session.user_id,
        user_name=session.user.full_name if session.user else "Unknown",
        project_id=session.project_id,
        project_name=session.project.name if session.project else "Unknown",
        client_name=session.project.client_name if session.project else "Unknown",
        start_time=session.start_time,
        end_time=session.end_time,
        duration_hours=duration_hrs,
        is_active=session.is_active,
        notes=session.notes
    )

@router.post("/punch-in", response_model=PunchSessionResponse)
def punch_in(
    payload: PunchInRequest,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Punch In: User MUST select a project they are assigned to.
    Rejects if user already has an active punch session.
    """
    # 1. Check if user already has an active session
    active_existing = db.query(PunchSession).filter(
        PunchSession.user_id == current_user.id,
        PunchSession.is_active == True
    ).first()
    if active_existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have an active punch session. Please punch out first before punching in again."
        )

    # 2. Strict RBAC verification: Project MUST be assigned to user (or user is PM/Admin of it)
    deps.verify_project_access(payload.project_id, current_user, db)

    # 3. Create active PunchSession
    now = datetime.utcnow()
    new_session = PunchSession(
        user_id=current_user.id,
        project_id=payload.project_id,
        start_time=now,
        is_active=True,
        notes=payload.notes.strip() if payload.notes else None
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    log_audit(
        db=db,
        action="PUNCH_IN",
        entity_type="PunchSession",
        user_id=current_user.id,
        entity_id=str(new_session.id),
        new_values={"project_id": payload.project_id, "start_time": now.isoformat()},
        request=request
    )

    return build_punch_response(new_session)

@router.post("/punch-out", response_model=PunchSessionResponse)
def punch_out(
    payload: PunchOutRequest,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Punch Out: Closes active session, calculates logged time,
    and automatically records a TimeEntry for budget and cap tracking.
    """
    active_session = db.query(PunchSession).filter(
        PunchSession.user_id == current_user.id,
        PunchSession.is_active == True
    ).first()
    if not active_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active punch session found to punch out from."
        )

    now = datetime.utcnow()
    active_session.end_time = now
    active_session.is_active = False
    if payload.notes:
        if active_session.notes:
            active_session.notes += f" | {payload.notes.strip()}"
        else:
            active_session.notes = payload.notes.strip()

    # Calculate hours
    delta = now - active_session.start_time
    # Ensure minimum 0.01 hours if just punched
    hours_logged = max(0.01, round(delta.total_seconds() / 3600.0, 2))

    # Record automatic TimeEntry
    time_entry = TimeEntry(
        project_id=active_session.project_id,
        user_id=current_user.id,
        date=active_session.start_time.date(),
        hours=hours_logged,
        notes=active_session.notes or "Logged via Punch Clock",
        updated_by=current_user.id
    )
    db.add(time_entry)
    db.commit()
    db.refresh(active_session)

    log_audit(
        db=db,
        action="PUNCH_OUT",
        entity_type="PunchSession",
        user_id=current_user.id,
        entity_id=str(active_session.id),
        new_values={
            "end_time": now.isoformat(),
            "duration_hours": hours_logged,
            "notes": active_session.notes
        },
        request=request
    )

    return build_punch_response(active_session)

@router.get("/active", response_model=Optional[PunchSessionResponse])
def get_active_punch_session(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """Returns the user's current ongoing punch session, if any."""
    active = db.query(PunchSession).filter(
        PunchSession.user_id == current_user.id,
        PunchSession.is_active == True
    ).first()
    if not active:
        return None
    return build_punch_response(active)

@router.get("/daily", response_model=DailyPunchSummary)
def get_daily_punch_sessions(
    target_date: Optional[date] = Query(None, description="Date to query, default today"),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """
    Shows user's list of Punch Ins for a selected day and total hours logged.
    """
    query_date = target_date or datetime.utcnow().date()

    # Query sessions that started on that calendar day
    sessions = db.query(PunchSession).filter(
        PunchSession.user_id == current_user.id,
        func.date(PunchSession.start_time) == query_date
    ).order_by(PunchSession.start_time.desc()).all()

    # Calculate total hours logged on that day
    total_hours = sum(
        round((s.end_time - s.start_time).total_seconds() / 3600.0, 2)
        for s in sessions if s.end_time and s.start_time
    )

    # Active session if still ongoing today
    active = next((s for s in sessions if s.is_active), None)

    return DailyPunchSummary(
        date=query_date,
        total_hours_logged=round(total_hours, 2),
        active_session=build_punch_response(active) if active else None,
        sessions=[build_punch_response(s) for s in sessions]
    )

