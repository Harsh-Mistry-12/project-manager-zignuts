from sqlalchemy.orm import Session
from app.core import security
from app.models.models import Role, User


def seed_database(db: Session):
    """Ensures the three base roles and a default admin user exist on startup."""
    # 1. Seed Roles (idempotent)
    roles_data = ["admin", "pm", "member"]
    role_map = {}
    for r_name in roles_data:
        role = db.query(Role).filter(Role.role_name == r_name).first()
        if not role:
            role = Role(role_name=r_name)
            db.add(role)
            db.commit()
            db.refresh(role)
        role_map[r_name] = role

    # 2. Seed default Admin user (idempotent)
    admin_email = "admin@example.com"
    if not db.query(User).filter(User.email == admin_email).first():
        admin = User(
            email=admin_email,
            full_name="Admin",
            password_hash=security.get_password_hash("Admin@123"),
            role_id=role_map["admin"].id,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"[Seed] Default admin created → email: {admin_email}  password: Admin@123")
    else:
        print(f"[Seed] Admin user already exists, skipping.")

