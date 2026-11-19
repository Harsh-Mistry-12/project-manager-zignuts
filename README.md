# Zignuts Retainer Project Management & Time Tracking App

> **Software Engineer Take-Home Implementation**  
> Scope: Project creation, monthly retainer cap tracking, punch clock & daily logs, annual utilization heatmap, staff approval & allocation, backend-enforced RBAC, and an RBAC-aware RAG Q&A Assistant.

---

## 🚀 Quick Start with Docker (Recommended)

Run a single command to bring up the database, backend, and frontend:

```bash
docker compose up --build
```

- **Frontend App:** [http://localhost:3000](http://localhost:3000)
- **FastAPI Interactive Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check:** [http://localhost:8000/health](http://localhost:8000/health)

---

## 👥 Pre-seeded Demo Accounts

All test accounts come pre-configured with the default password: **`Password123!`**.  
The UI features a **"1-Click Quick Demo Sign-In"** selector on the login screen and navbar for instant switching during evaluation.

| Role | Name | Email | Notes & Permissions |
|---|---|---|---|
| **Admin** | Sarah Connor | `admin@zignuts.com` | Full organization visibility, user approvals, role edits, global cap metrics, audit logs |
| **PM 1** | Alex Vance | `pm1@zignuts.com` | Manages **Project Alpha**, **Project Beta**, and **Project Gamma** |
| **PM 2** | Gordon Freeman | `pm2@zignuts.com` | Manages **Project Delta** (isolated from PM 1) |
| **Member** | Harsh Patel | `dev1@zignuts.com` | Assigned to Project Alpha & Project Beta |
| **Member** | Elena Rostova | `dev2@zignuts.com` | Assigned to Project Alpha & Project Gamma |
| **Member** | Marcus Brody | `dev3@zignuts.com` | Assigned to Project Beta & Project Delta |
| **Pending**| New Hire | `pending@zignuts.com` | Registered but pending Admin approval (`is_active = false`) |

---

## 🏗️ Architecture & Production Schema

```
Database: MySQL 8.0
Backend:  FastAPI (Python 3.11+, SQLAlchemy, Pydantic v2, PyMySQL, Bcrypt, PyJWT)
Frontend: Next.js 14 (App Router, Tailwind CSS, Lucide React, TypeScript)
```

### Production Database Tables

1. **`roles`**: `(id, role_name, created_at)`
2. **`users`**: `(id, email, password_hash, full_name, role_id, is_active, created_at, is_deleted, deleted_at)`
   - Passwords securely hashed with `bcrypt`. Soft delete support.
3. **`projects`**: `(id, name, client_name, monthly_hourly_cap, created_by, created_at, budget, assigned_pm_id)`
4. **`project_members`**: `(id, project_id, user_id, assigned_at)`
   - Maps staff allocations assigned by PMs/Admins.
5. **`time_entries`**: `(id, project_id, user_id, date, hours, notes, created_at, updated_at, updated_by, is_deleted, deleted_at)`
   - Soft delete support.
6. **`punch_sessions`**: `(id, user_id, project_id, start_time, end_time, is_active, notes)`
   - Tracks ongoing work sessions. Punching out automatically syncs into billable `time_entries`.
7. **`audit_logs`**: `(id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, created_at)`
   - Immutable audit trail of logins, project creations, member assignments, punch actions, and AI queries.

---

## 🎯 Features Implemented

### 1. Admin Panel
- **Staff Access & Approvals:** One-click approval toggle for pending accounts, role reassignment (`admin`, `pm`, `member`).
- **Organization-Wide Projects Overview:** View all retainer projects, running totals of hours logged in current month vs cap.
- **Cap Warning Indicators:**
  - 🟢 **Normal:** $<90\%$ of monthly cap.
  - 🟡 **Warning:** Within $10\%$ of cap ($\ge 90\%$).
  - 🔴 **Over Cap:** Exceeded retainer hours ($>100\%$).
- **Audit Trail Viewer:** Real-time chronological system actions, mutations, and IP logs.

### 2. Project Manager Portal (Sections 1 to 4)
- **Sec 1 (PM Projects Listing):** Filtered strictly to projects the PM created or was assigned to manage.
- **Sec 2 (Project Details & Assigned Team):** Deep-dive into monthly retainer, client name, assigned team members, and individual member logged hours.
- **Sec 3 (Annual Heatmap View):** 12-month calendar matrix per project (Jan–Dec) displaying monthly cap vs. hours logged with color-coded intensity.
- **Sec 4 (PM User Management):** Interface allowing PMs to view organization developers and allocate them to managed projects.

### 3. Punch In / Punch Out & Daily Time Log
- **Mandatory Project Selection:** Users must select a project they are explicitly assigned to before punching in.
- **Live Ticking Stopwatch:** Live duration timer while punched in.
- **Punch Out Flow:** Automatically records end time, duration, wrap-up notes, and writes a billable `TimeEntry`.
- **List of Punch In's in One Day:** Filter by date, showing each punch interval and **total time logged for that day**.
- **Manual Time Logging:** Dedicated form for adding past date, hours, and task notes.

### 4. RBAC-Aware Q&A AI Assistant (RAG Engine)
- **Strict Backend Permission Filtering:**
  - **Admin:** Context includes all organization projects and hours.
  - **PM:** Context is strictly limited to their managed projects.
  - **Member:** Context is strictly limited to projects they are assigned to.
- **Polite Denial Enforcement:**
  - If a PM asks: *"Who is the project manager for Project Delta?"* (a project managed by PM 2), the system detects unauthorized project access and politely denies:
    > *"I cannot provide information regarding 'Project Delta'. Project Managers are only permitted to view and query their own assigned projects. Please consult your Organization Administrator."*
- **Natural Language Answering:** Answers questions like:
  - *"How many hours spent on Project Alpha in January 2026?"*
  - *"Who is the project manager for Project Alpha?"*
  - *"What is the monthly cap for Project Beta?"*
  - *"Who is assigned to Project Alpha?"*
- **Zero External Dependency Fallback:** Works 100% out of the box with the grounded deterministic RAG engine even without external keys, while supporting Gemini API (`GEMINI_API_KEY`) or OpenAI (`OPENAI_API_KEY`) when provided.

---

## 💻 Local Development (Without Docker)

### 1. Backend Setup
```bash
# In project root
python -m venv .venv
.\.venv\Scripts\activate

pip install -r backend/requirements.txt
cp .env.example .env

# Set USE_SQLITE_FALLBACK=true in .env for zero-config local testing
uvicorn app.main:app --app-dir backend --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

