from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.api import deps
from app.models.models import User
from app.schemas.schemas import AIQueryRequest, AIQueryResponse
from app.services.rag_service import process_rag_query
from app.services.audit_service import log_audit

router = APIRouter()

@router.post("/query", response_model=AIQueryResponse)
async def query_ai_assistant(
    payload: AIQueryRequest,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """
    RBAC-Aware RAG Assistant:
    - Admin can query all organization projects and hours.
    - PM can only query their own managed projects.
    - Member can only query projects they are assigned to.
    - Unauthorized project queries are politely denied.
    """
    result = await process_rag_query(db, current_user, payload.query)

    action_type = "AI_QUERY_ANSWERED" if result["is_allowed"] else "AI_QUERY_DENIED"
    log_audit(
        db=db,
        action=action_type,
        entity_type="RAG",
        user_id=current_user.id,
        entity_id=None,
        new_values={
            "query": payload.query,
            "is_allowed": result["is_allowed"],
            "referenced_projects": result["referenced_projects"]
        },
        request=request
    )

    return AIQueryResponse(**result)

