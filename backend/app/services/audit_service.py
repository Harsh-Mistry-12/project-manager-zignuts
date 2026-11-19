import json
from typing import Optional, Any
from fastapi import Request
from sqlalchemy.orm import Session
from app.models.models import AuditLog

def log_audit(
    db: Session,
    action: str,
    entity_type: str,
    user_id: Optional[int] = None,
    entity_id: Optional[str] = None,
    old_values: Optional[Any] = None,
    new_values: Optional[Any] = None,
    request: Optional[Request] = None
):
    ip_address = None
    user_agent = None
    if request:
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

    log_entry = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
        user_agent=user_agent
    )
    db.add(log_entry)
    db.commit()
    return log_entry
