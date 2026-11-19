import os
import sys

# Ensure backend root is on Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from datetime import date, datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["USE_SQLITE_FALLBACK"] = "true"
os.environ["SECRET_KEY"] = "test-secret-key-12345"

from app.core.database import Base, get_db
from app.main import app
from app.seed import seed_database
from app.models.models import User, Project, TimeEntry, PunchSession, AuditLog

TEST_DB_URL = "sqlite:///./test_rbac.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

# Initialize & seed DB for testing
Base.metadata.drop_all(bind=test_engine)
Base.metadata.create_all(bind=test_engine)
db = TestingSessionLocal()
seed_database(db)
db.close()

client = TestClient(app)

def get_token(email: str, password: str = "Password123!"):
    res = client.post("/api/v1/auth/login/json", json={"email": email, "password": password})
    return res

def test_01_auth_active_and_inactive_users():
    """Verify active user can log in, and pending user is rejected."""
    # Active Admin
    res_admin = get_token("admin@zignuts.com")
    assert res_admin.status_code == 200
    assert "access_token" in res_admin.json()

    # Inactive Pending user
    res_pending = get_token("pending@zignuts.com")
    assert res_pending.status_code == 403
    assert "approval" in res_pending.json()["detail"].lower()

def test_02_project_listing_rbac_isolation():
    """Verify project listing is strictly isolated by role."""
    token_admin = get_token("admin@zignuts.com").json()["access_token"]
    token_pm1 = get_token("pm1@zignuts.com").json()["access_token"]
    token_pm2 = get_token("pm2@zignuts.com").json()["access_token"]
    token_dev1 = get_token("dev1@zignuts.com").json()["access_token"]

    # 1. Admin should see all 4 projects
    res_admin = client.get("/api/v1/projects", headers={"Authorization": f"Bearer {token_admin}"})
    assert res_admin.status_code == 200
    assert len(res_admin.json()) == 4

    # 2. PM 1 should only see Alpha, Beta, Gamma (3 projects)
    res_pm1 = client.get("/api/v1/projects", headers={"Authorization": f"Bearer {token_pm1}"})
    assert res_pm1.status_code == 200
    pm1_project_names = [p["name"] for p in res_pm1.json()]
    assert len(pm1_project_names) == 3
    assert not any("Project Delta" in name for name in pm1_project_names)

    # 3. PM 2 should only see Project Delta (1 project)
    res_pm2 = client.get("/api/v1/projects", headers={"Authorization": f"Bearer {token_pm2}"})
    assert res_pm2.status_code == 200
    assert len(res_pm2.json()) == 1
    assert "Project Delta" in res_pm2.json()[0]["name"]

    # 4. Dev 1 (member) assigned only to Alpha & Beta (2 projects)
    res_dev1 = client.get("/api/v1/projects", headers={"Authorization": f"Bearer {token_dev1}"})
    assert res_dev1.status_code == 200
    dev1_project_names = [p["name"] for p in res_dev1.json()]
    assert len(dev1_project_names) == 2
    assert not any("Project Gamma" in name for name in dev1_project_names)
    assert not any("Project Delta" in name for name in dev1_project_names)

def test_03_member_cannot_create_project():
    """Verify members cannot create projects via direct API call."""
    token_dev1 = get_token("dev1@zignuts.com").json()["access_token"]
    res = client.post("/api/v1/projects", headers={"Authorization": f"Bearer {token_dev1}"}, json={
        "name": "Rogue Project",
        "client_name": "Rogue Client",
        "monthly_hourly_cap": 160.0
    })
    assert res.status_code == 403
    assert "Operation not permitted" in res.json()["detail"]

def test_04_pm_cannot_modify_other_pm_project():
    """Verify PM 1 cannot update PM 2's project (Project Delta id=4)."""
    token_pm1 = get_token("pm1@zignuts.com").json()["access_token"]
    res = client.put("/api/v1/projects/4", headers={"Authorization": f"Bearer {token_pm1}"}, json={
        "name": "Hacked Project Delta"
    })
    assert res.status_code == 403
    assert "only access projects you manage" in res.json()["detail"]

def test_05_pm_cannot_assign_members_to_other_pm_project():
    """Verify PM 1 cannot assign members to PM 2's project."""
    token_pm1 = get_token("pm1@zignuts.com").json()["access_token"]
    res = client.post("/api/v1/projects/4/members", headers={"Authorization": f"Bearer {token_pm1}"}, json={
        "user_ids": [4]
    })
    assert res.status_code == 403
    assert "only access projects you manage" in res.json()["detail"]

def test_06_member_cannot_log_time_on_unassigned_project():
    """Verify Dev 1 cannot log time on unassigned Project Gamma (id=3)."""
    token_dev1 = get_token("dev1@zignuts.com").json()["access_token"]
    res = client.post("/api/v1/time-entries", headers={"Authorization": f"Bearer {token_dev1}"}, json={
        "project_id": 3,
        "date": str(date.today()),
        "hours": 5.0,
        "notes": "Unauthorized attempt"
    })
    assert res.status_code == 403
    assert "not assigned to this project" in res.json()["detail"]

def test_07_member_cannot_punch_in_to_unassigned_project():
    """Verify Dev 1 cannot punch in to Project Delta (id=4)."""
    token_dev1 = get_token("dev1@zignuts.com").json()["access_token"]
    res = client.post("/api/v1/punch-sessions/punch-in", headers={"Authorization": f"Bearer {token_dev1}"}, json={
        "project_id": 4,
        "notes": "Attempting punch in on unassigned project"
    })
    assert res.status_code == 403
    assert "not assigned to this project" in res.json()["detail"]

def test_08_pm_cannot_delete_other_pm_time_entry():
    """Verify PM 1 cannot delete a time entry on PM 2's Project Delta."""
    token_pm1 = get_token("pm1@zignuts.com").json()["access_token"]
    # Find an entry on Project Delta (project_id=4)
    db_session = TestingSessionLocal()
    delta_entry = db_session.query(TimeEntry).filter(TimeEntry.project_id == 4, TimeEntry.is_deleted == False).first()
    assert delta_entry is not None
    entry_id = delta_entry.id
    db_session.close()

    res = client.delete(f"/api/v1/time-entries/{entry_id}", headers={"Authorization": f"Bearer {token_pm1}"})
    assert res.status_code == 403
    assert "cannot delete time entries for projects you do not manage" in res.json()["detail"]

def test_09_admin_cannot_deactivate_self():
    """Verify Admin cannot accidentally deactivate their own account."""
    token_admin = get_token("admin@zignuts.com").json()["access_token"]
    res = client.patch("/api/v1/users/1", headers={"Authorization": f"Bearer {token_admin}"}, json={
        "is_active": False
    })
    assert res.status_code == 400
    assert "cannot deactivate their own account" in res.json()["detail"]

def test_10_annual_heatmap_rbac_isolation():
    """Verify PM 1 cannot view annual heatmap for PM 2's Project Delta."""
    token_pm1 = get_token("pm1@zignuts.com").json()["access_token"]
    res = client.get("/api/v1/stats/annual-heatmap/4", headers={"Authorization": f"Bearer {token_pm1}"})
    assert res.status_code == 403
    assert "only access projects you manage" in res.json()["detail"]

def test_11_rag_ai_assistant_polite_denials():
    """Verify RBAC RAG polite denial for unauthorized project and client queries."""
    token_pm1 = get_token("pm1@zignuts.com").json()["access_token"]
    token_dev1 = get_token("dev1@zignuts.com").json()["access_token"]

    # 1. PM 1 asking about Project Delta (PM 2's project)
    res_pm1_delta = client.post("/api/v1/ai/query", headers={"Authorization": f"Bearer {token_pm1}"}, json={
        "query": "Who is the project manager for Project Delta?"
    })
    assert res_pm1_delta.status_code == 200
    data1 = res_pm1_delta.json()
    assert data1["is_allowed"] is False
    assert "Project Managers are only permitted to view and query their own assigned projects" in data1["answer"]

    # 2. PM 1 asking about Nova Retail (Client of Project Delta)
    res_pm1_client = client.post("/api/v1/ai/query", headers={"Authorization": f"Bearer {token_pm1}"}, json={
        "query": "How many hours were billed for Nova Retail Ltd?"
    })
    assert res_pm1_client.status_code == 200
    data2 = res_pm1_client.json()
    assert data2["is_allowed"] is False

    # 3. Dev 1 asking about Project Gamma (unassigned)
    res_dev1_gamma = client.post("/api/v1/ai/query", headers={"Authorization": f"Bearer {token_dev1}"}, json={
        "query": "How many hours spent on Project Gamma in November 2026?"
    })
    assert res_dev1_gamma.status_code == 200
    data3 = res_dev1_gamma.json()
    assert data3["is_allowed"] is False
    assert "Team Members are only permitted to view and query their own assigned projects" in data3["answer"]

def test_12_rag_ai_assistant_authorized_query():
    """Verify authorized RAG query succeeds and returns accurate data."""
    token_pm1 = get_token("pm1@zignuts.com").json()["access_token"]
    res = client.post("/api/v1/ai/query", headers={"Authorization": f"Bearer {token_pm1}"}, json={
        "query": "How many hours spent on Project Alpha in January 2026?"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["is_allowed"] is True
    assert "80.0 hours" in data["answer"]
    assert "160 hrs" in data["answer"]

def test_13_audit_trail_recorded():
    """Verify security audit logs are created for security events."""
    token_admin = get_token("admin@zignuts.com").json()["access_token"]
    res = client.get("/api/v1/audit-logs", headers={"Authorization": f"Bearer {token_admin}"})
    assert res.status_code == 200
    logs = res.json()
    actions = [log["action"] for log in logs]
    assert "USER_LOGIN" in actions
    assert "AI_QUERY_DENIED" in actions

def test_14_admin_can_add_pm_and_users():
    """Verify Admin can create both PMs and regular users."""
    import uuid
    uid = uuid.uuid4().hex[:6]
    token_admin = get_token("admin@zignuts.com").json()["access_token"]

    # 1. Admin creates a new PM
    res_pm = client.post("/api/v1/users", headers={"Authorization": f"Bearer {token_admin}"}, json={
        "full_name": "New PM Lisa",
        "email": f"lisa_pm_{uid}@zignuts.com",
        "role_name": "pm"
    })
    assert res_pm.status_code == 200
    assert res_pm.json()["role_name"] == "pm"
    assert res_pm.json()["is_active"] is True

    # 2. Admin creates a new Member
    res_member = client.post("/api/v1/users", headers={"Authorization": f"Bearer {token_admin}"}, json={
        "full_name": "New Dev Dave",
        "email": f"dave_dev_{uid}@zignuts.com",
        "role_name": "member"
    })
    assert res_member.status_code == 200
    assert res_member.json()["role_name"] == "member"

def test_15_pm_can_add_users_but_not_pm_or_admin():
    """Verify PM can create regular users, but is forbidden from creating PMs or Admins."""
    import uuid
    uid = uuid.uuid4().hex[:6]
    token_pm1 = get_token("pm1@zignuts.com").json()["access_token"]

    # 1. PM creates a regular user (member) -> Allowed
    res_ok = client.post("/api/v1/users", headers={"Authorization": f"Bearer {token_pm1}"}, json={
        "full_name": "Junior Dev Kevin",
        "email": f"kevin_dev_{uid}@zignuts.com",
        "role_name": "member"
    })
    assert res_ok.status_code == 200
    assert res_ok.json()["role_name"] == "member"

    # 2. PM attempts to create a PM -> Forbidden (403)
    res_pm_denied = client.post("/api/v1/users", headers={"Authorization": f"Bearer {token_pm1}"}, json={
        "full_name": "Rogue PM Attempt",
        "email": f"rogue_pm_{uid}@zignuts.com",
        "role_name": "pm"
    })
    assert res_pm_denied.status_code == 403
    assert "only permitted to create team members" in res_pm_denied.json()["detail"]

    # 3. PM attempts to create an Admin -> Forbidden (403)
    res_admin_denied = client.post("/api/v1/users", headers={"Authorization": f"Bearer {token_pm1}"}, json={
        "full_name": "Rogue Admin Attempt",
        "email": f"rogue_admin_{uid}@zignuts.com",
        "role_name": "admin"
    })
    assert res_admin_denied.status_code == 403
