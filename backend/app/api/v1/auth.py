from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.api import deps
from app.core import security
from app.models.models import User, Role
from app.schemas.schemas import UserCreate, UserLogin, UserResponse, TokenResponse
from app.services.audit_service import log_audit

router = APIRouter()

def build_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role_id=user.role_id,
        role_name=user.role.role_name if user.role else "member",
        is_active=user.is_active,
        created_at=user.created_at
    )

@router.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, request: Request, db: Session = Depends(deps.get_db)):
    # Check if email exists
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    # Get requested role
    role = db.query(Role).filter(Role.role_name == (user_in.role_name or "member").lower()).first()
    if not role:
        role = db.query(Role).filter(Role.role_name == "member").first()

    # Create new user (default is_active=True or can require admin approval)
    new_user = User(
        email=user_in.email.lower().strip(),
        password_hash=security.get_password_hash(user_in.password),
        full_name=user_in.full_name.strip(),
        role_id=role.id,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_audit(
        db=db,
        action="USER_REGISTER",
        entity_type="User",
        user_id=new_user.id,
        entity_id=str(new_user.id),
        new_values={"email": new_user.email, "role": role.role_name},
        request=request
    )

    return build_user_response(new_user)

@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), request: Request = None, db: Session = Depends(deps.get_db)):
    user = db.query(User).filter(User.email == form_data.username.lower().strip(), User.is_deleted == False).first()
    if not user or not security.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is inactive or awaiting administrator approval."
        )

    access_token = security.create_access_token(subject=user.id)

    log_audit(
        db=db,
        action="USER_LOGIN",
        entity_type="User",
        user_id=user.id,
        entity_id=str(user.id),
        request=request
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=build_user_response(user)
    )

@router.post("/login/json", response_model=TokenResponse)
def login_json(payload: UserLogin, request: Request, db: Session = Depends(deps.get_db)):
    user = db.query(User).filter(User.email == payload.email.lower().strip(), User.is_deleted == False).first()
    if not user or not security.verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is inactive or awaiting administrator approval."
        )

    access_token = security.create_access_token(subject=user.id)

    log_audit(
        db=db,
        action="USER_LOGIN",
        entity_type="User",
        user_id=user.id,
        entity_id=str(user.id),
        request=request
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=build_user_response(user)
    )

@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(deps.get_current_user)):
    return build_user_response(current_user)

