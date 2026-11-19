from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from app.core import security
from app.models.models import Role, User, Project, ProjectMember, TimeEntry, PunchSession, AuditLog

def seed_database(db: Session):
    """Populates initial roles, demo users (Admin, PM, Employees), projects, and realistic logs."""
    # 1. Seed Roles
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

    # 2. Seed Users
    # Password for all demo accounts: 'Password123!'
    default_pw = security.get_password_hash("Password123!")

    users_data = [
        {"email": "admin@zignuts.com", "full_name": "Sarah Connor (Admin)", "role": "admin"},
        {"email": "pm1@zignuts.com", "full_name": "Alex Vance (PM - Core Retainers)", "role": "pm"},
        {"email": "pm2@zignuts.com", "full_name": "Gordon Freeman (PM - Mobile & Cloud)", "role": "pm"},
        {"email": "dev1@zignuts.com", "full_name": "Harsh Patel (Senior Dev)", "role": "member"},
        {"email": "dev2@zignuts.com", "full_name": "Elena Rostova (Frontend Dev)", "role": "member"},
        {"email": "dev3@zignuts.com", "full_name": "Marcus Brody (QA / DevOps)", "role": "member"},
        {"email": "pending@zignuts.com", "full_name": "New Hire (Pending Approval)", "role": "member", "is_active": False},
    ]

    user_map = {}
    for u in users_data:
        existing = db.query(User).filter(User.email == u["email"]).first()
        if not existing:
            new_u = User(
                email=u["email"],
                full_name=u["full_name"],
                password_hash=default_pw,
                role_id=role_map[u["role"]].id,
                is_active=u.get("is_active", True)
            )
            db.add(new_u)
            db.commit()
            db.refresh(new_u)
            user_map[u["email"]] = new_u
        else:
            user_map[u["email"]] = existing

    # 3. Seed Projects
    # We create projects with realistic monthly caps:
    # Project A: Managed by PM 1, ~85% normal
    # Project B: Managed by PM 1, 95% warning
    # Project C: Managed by PM 1, 110% over cap
    # Project D: Managed by PM 2, Managed by Gordon
    pm1 = user_map["pm1@zignuts.com"]
    pm2 = user_map["pm2@zignuts.com"]
    dev1 = user_map["dev1@zignuts.com"]
    dev2 = user_map["dev2@zignuts.com"]
    dev3 = user_map["dev3@zignuts.com"]

    projects_data = [
        {
            "name": "Project Alpha (Fintech App)",
            "client_name": "Apex Financial Group",
            "monthly_hourly_cap": 160.00,
            "budget": 12000.00,
            "created_by": pm1.id,
            "assigned_pm_id": pm1.id,
            "members": [dev1, dev2]
        },
        {
            "name": "Project Beta (Healthcare Portal)",
            "client_name": "MediCare Systems",
            "monthly_hourly_cap": 120.00,
            "budget": 9500.00,
            "created_by": pm1.id,
            "assigned_pm_id": pm1.id,
            "members": [dev1, dev3]
        },
        {
            "name": "Project Gamma (IoT Fleet Tracking)",
            "client_name": "Omni Logistics Corp",
            "monthly_hourly_cap": 100.00,
            "budget": 8000.00,
            "created_by": pm1.id,
            "assigned_pm_id": pm1.id,
            "members": [dev2]
        },
        {
            "name": "Project Delta (E-Commerce Engine)",
            "client_name": "Nova Retail Ltd",
            "monthly_hourly_cap": 200.00,
            "budget": 16000.00,
            "created_by": pm2.id,
            "assigned_pm_id": pm2.id,
            "members": [dev3]
        }
    ]

    project_map = {}
    for p_info in projects_data:
        p = db.query(Project).filter(Project.name == p_info["name"]).first()
        if not p:
            p = Project(
                name=p_info["name"],
                client_name=p_info["client_name"],
                monthly_hourly_cap=p_info["monthly_hourly_cap"],
                budget=p_info["budget"],
                created_by=p_info["created_by"],
                assigned_pm_id=p_info["assigned_pm_id"]
            )
            db.add(p)
            db.commit()
            db.refresh(p)

            # Assign members
            for m in p_info["members"]:
                assoc = ProjectMember(project_id=p.id, user_id=m.id)
                db.add(assoc)
            db.commit()
        project_map[p_info["name"]] = p

    # 4. Seed Time Entries across past months & current month
    today = date.today()
    existing_entries_count = db.query(TimeEntry).count()
    if existing_entries_count == 0:
        p_alpha = project_map["Project Alpha (Fintech App)"]
        p_beta = project_map["Project Beta (Healthcare Portal)"]
        p_gamma = project_map["Project Gamma (IoT Fleet Tracking)"]
        p_delta = project_map["Project Delta (E-Commerce Engine)"]

        # Alpha: ~115 hrs in current month (normal ~72%)
        for i in range(1, 15):
            d = today - timedelta(days=i)
            db.add(TimeEntry(project_id=p_alpha.id, user_id=dev1.id, date=d, hours=4.5, notes=f"Sprint {i} API development & testing"))
            db.add(TimeEntry(project_id=p_alpha.id, user_id=dev2.id, date=d, hours=3.5, notes=f"UI components & integration"))

        # Beta: ~112 hrs (Cap 120 -> 93.3% WARNING)
        for i in range(1, 14):
            d = today - timedelta(days=i)
            db.add(TimeEntry(project_id=p_beta.id, user_id=dev1.id, date=d, hours=5.0, notes="Patient medical records API"))
            db.add(TimeEntry(project_id=p_beta.id, user_id=dev3.id, date=d, hours=3.5, notes="End-to-end integration tests"))

        # Gamma: ~108 hrs (Cap 100 -> 108% OVER CAP)
        for i in range(1, 18):
            d = today - timedelta(days=i)
            db.add(TimeEntry(project_id=p_gamma.id, user_id=dev2.id, date=d, hours=6.0, notes="GPS live stream telemetry frontend"))

        # Delta: ~60 hrs
        for i in range(1, 10):
            d = today - timedelta(days=i)
            db.add(TimeEntry(project_id=p_delta.id, user_id=dev3.id, date=d, hours=6.0, notes="Cart & Checkout microservice"))

        # Add some historical entries for January 2026 / previous months to show annual heatmap & RAG queries
        # E.g. "how many hours spent on Project A in January 2026"
        jan_2026_date1 = date(2026, 1, 10)
        jan_2026_date2 = date(2026, 1, 18)
        db.add(TimeEntry(project_id=p_alpha.id, user_id=dev1.id, date=jan_2026_date1, hours=45.0, notes="January 2026 Milestone 1 Delivery"))
        db.add(TimeEntry(project_id=p_alpha.id, user_id=dev2.id, date=jan_2026_date2, hours=35.0, notes="January 2026 Frontend Redesign"))

        db.commit()

    # 5. Seed Punch Sessions for today
    existing_punch = db.query(PunchSession).count()
    if existing_punch == 0:
        p_alpha = project_map["Project Alpha (Fintech App)"]
        # Morning punch session completed today
        morning_start = datetime.utcnow().replace(hour=4, minute=0, second=0)
        morning_end = datetime.utcnow().replace(hour=8, minute=30, second=0)
        db.add(PunchSession(
            user_id=dev1.id,
            project_id=p_alpha.id,
            start_time=morning_start,
            end_time=morning_end,
            is_active=False,
            notes="Morning feature sprint & code reviews"
        ))
        db.commit()
