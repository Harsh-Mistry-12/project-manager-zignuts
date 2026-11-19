from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.api import deps
from app.models.models import User, Role, ProjectMember
from app.schemas.schemas import UserResponse, UserRoleUpdate, StaffCreateUser
from app.core import security
from app.api.v1.auth import build_user_response
from app.services.audit_service import log_audit

router = APIRouter()

@router.get("", response_model=List[UserResponse])
@router.get("/", response_model=List[UserResponse])
def get_all_users(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["admin", "pm"]))
):
    """
    Admin can see all users.
    PM can see all active users (to assign members to their projects).
    """
    user_role = current_user.role.role_name if current_user.role else "member"
    if user_role == "admin":
        users = db.query(User).filter(User.is_deleted == False).order_by(User.id.asc()).all()
    else:
        # PM view - active members and PMs
        users = db.query(User).filter(User.is_deleted == False, User.is_active == True).order_by(User.full_name.asc()).all()

    return [build_user_response(u) for u in users]

@router.post("", response_model=UserResponse)
@router.post("/", response_model=UserResponse)
def create_user_by_staff(
    payload: StaffCreateUser,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["admin", "pm"]))
):
    """
    Staff User Creation:
    - Admin can create PMs and Users (members).
    - PM can ONLY create Users (members).
    """
    creator_role = current_user.role.role_name if current_user.role else "member"
    requested_role = (payload.role_name or "member").lower().strip()

    # RBAC Enforcement: PM can ONLY add Users (role='member')
    if creator_role == "pm":
        if requested_role != "member":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Project Managers are only permitted to create team members / users."
            )

    # Check if email exists
    existing = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    # Get target role
    role = db.query(Role).filter(Role.role_name == requested_role).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{requested_role}' is invalid."
        )

    pw = payload.password if payload.password else "Password123!"

    new_user = User(
        email=payload.email.lower().strip(),
        password_hash=security.get_password_hash(pw),
        full_name=payload.full_name.strip(),
        role_id=role.id,
        is_active=True  # Staff-created accounts are immediately active
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # If an initial project assignment is requested:
    if payload.initial_project_id:
        deps.verify_project_access(payload.initial_project_id, current_user, db)
        assignment = ProjectMember(project_id=payload.initial_project_id, user_id=new_user.id)
        db.add(assignment)
        db.commit()

    log_audit(
        db=db,
        action="USER_CREATED_BY_STAFF",
        entity_type="User",
        user_id=current_user.id,
        entity_id=str(new_user.id),
        new_values={
            "email": new_user.email,
            "role": role.role_name,
            "created_by_role": creator_role,
            "initial_project_id": payload.initial_project_id
        },
        request=request
    )

    return build_user_response(new_user)

@router.patch("/{user_id}", response_model=UserResponse)
def update_user_status_or_role(
    user_id: int,
    payload: UserRoleUpdate,
    request: Request,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.require_roles(["admin"]))
):
    """Admin-only: update user active status (approval) or assign role."""
    target_user = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Safety guard: Prevent admin self-deactivation or self-demotion
    if target_user.id == current_user.id:
        if payload.is_active is False:
            raise HTTPException(status_code=400, detail="Admins cannot deactivate their own account.")
        if payload.role_name and payload.role_name.lower().strip() != "admin":
            raise HTTPException(status_code=400, detail="Admins cannot revoke their own admin role.")

    old_values = {
        "is_active": target_user.is_active,
        "role": target_user.role.role_name if target_user.role else None
    }

    if payload.is_active is not None:
        target_user.is_active = payload.is_active

    if payload.role_name:
        role = db.query(Role).filter(Role.role_name == payload.role_name.lower().strip()).first()
        if not role:
            raise HTTPException(status_code=400, detail=f"Role '{payload.role_name}' does not exist")
        target_user.role_id = role.id

    db.commit()
    db.refresh(target_user)

    log_audit(
        db=db,
        action="USER_UPDATE_ROLE_OR_STATUS",
        entity_type="User",
        user_id=current_user.id,
        entity_id=str(target_user.id),
        old_values=old_values,
        new_values={"is_active": target_user.is_active, "role": target_user.role.role_name},
        request=request
    )

    return build_user_response(target_user)
