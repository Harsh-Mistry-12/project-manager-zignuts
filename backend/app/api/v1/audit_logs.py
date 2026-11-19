from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api import deps
from app.models.models import AuditLog, User
from app.schemas.schemas import AuditLogResponse

router = APIRouter()

@router.get("", response_model=List[AuditLogResponse])
@router.get("/", response_model=List[AuditLogResponse])
def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["admin"]))
):
    """Admin-only: query recent audit log activities."""
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)

    logs = query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(limit).all()

    # Pre-fetch user emails for display
    user_ids = {log.user_id for log in logs if log.user_id}
    users_map = {u.id: u.email for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

    results = []
    for log in logs:
        results.append(
            AuditLogResponse(
                id=log.id,
                user_id=log.user_id,
                user_email=users_map.get(log.user_id, "System / Unregistered"),
                action=log.action,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                old_values=log.old_values,
                new_values=log.new_values,
                ip_address=log.ip_address,
                created_at=log.created_at
            )
        )
    return results
