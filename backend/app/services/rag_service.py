import re
import calendar
from datetime import datetime, date
from typing import Dict, Any, List, Tuple, Optional
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from app.models.models import Project, ProjectMember, TimeEntry, User, PunchSession, Role
from app.core.config import settings

# Role hierarchy levels: Member (1) < PM (2) < Admin (3)
ROLE_LEVELS: Dict[str, int] = {
    "member": 1,
    "pm": 2,
    "admin": 3
}

def get_authorized_projects(db: Session, user: User) -> List[Project]:
    """Retrieve only projects that the current user has rights to view."""
    role = user.role.role_name if user.role else "member"
    if role == "admin":
        return db.query(Project).all()
    elif role == "pm":
        return db.query(Project).filter(
            (Project.created_by == user.id) | (Project.assigned_pm_id == user.id)
        ).all()
    else:  # member
        assigned_project_ids = db.query(ProjectMember.project_id).filter(
            ProjectMember.user_id == user.id
        ).all()
        project_ids = [p[0] for p in assigned_project_ids]
        return db.query(Project).filter(Project.id.in_(project_ids)).all()

def project_matches_query(project: Project, query_lower: str) -> bool:
    """Checks if project name, base name, or client name is referenced in the query."""
    p_full = project.name.lower()
    base_name = p_full.split("(")[0].strip()
    parentheses_part = p_full.split("(")[1].replace(")", "").strip() if "(" in p_full else ""
    client_name = project.client_name.lower() if project.client_name else ""

    candidates = [p_full, base_name, client_name]
    if parentheses_part:
        candidates.append(parentheses_part)

    # Also check distinct first word of client if > 3 chars (e.g. "Nova" from "Nova Retail Ltd")
    client_words = [w for w in client_name.split() if len(w) > 3]
    candidates.extend(client_words)

    for c in candidates:
        if len(c) > 2 and (c in query_lower or re.search(r'\b' + re.escape(c) + r'\b', query_lower)):
            return True
    return False

def find_referenced_users(db: Session, query: str) -> List[User]:
    """
    Finds all User records whose full name, email, or distinct first/last name
    is explicitly referenced in the user query.
    """
    all_users = db.query(User).filter(User.is_deleted == False).all()
    q_lower = query.lower()
    matched = []

    for u in all_users:
        u_name = u.full_name.lower()
        # Remove parenthetical tags like '(Admin)', '(Senior Dev)', '(PM - ...)'
        clean_name = re.sub(r'\(.*?\)', '', u_name).strip()
        email_prefix = u.email.split("@")[0].lower()

        # 1. Match full clean name
        if len(clean_name) > 3 and (clean_name in q_lower or re.search(r'\b' + re.escape(clean_name) + r'\b', q_lower)):
            if u not in matched:
                matched.append(u)
            continue

        # 2. Match email or email username prefix
        if u.email.lower() in q_lower or (len(email_prefix) > 3 and re.search(r'\b' + re.escape(email_prefix) + r'\b', q_lower)):
            if u not in matched:
                matched.append(u)
            continue

        # 3. Match distinct first or last name words
        parts = [p.strip() for p in clean_name.split() if len(p.strip()) > 3]
        for part in parts:
            if part in ["with", "from", "user", "role", "time", "date", "what", "hours", "info", "show", "tell"]:
                continue
            if re.search(r'\b' + re.escape(part) + r'\b', q_lower):
                if u not in matched:
                    matched.append(u)
                break

    return matched

def check_rbac_permission_for_query(
    db: Session, user: User, query_text: str
) -> Tuple[bool, Optional[str], List[Project], List[User]]:
    """
    Comprehensive RBAC Security Gatekeeper:
    - User/Member: Can only know their own info & assigned projects. Cannot query other users, PMs, or Admins.
    - PM: Can know their own info, assigned members' info, and their projects. Cannot query Admin or other PMs.
    - Admin: Can know everyone's info (Members, PMs, Admins, all projects).
    Returns (is_allowed, denial_reason, authorized_projects, referenced_users).
    """
    all_projects = db.query(Project).all()
    authorized_projects = get_authorized_projects(db, user)
    authorized_project_ids = {p.id for p in authorized_projects}

    caller_role = user.role.role_name if user.role else "member"
    caller_level = ROLE_LEVELS.get(caller_role, 1)
    q_lower = query_text.lower()

    # 1. Check Project-level RBAC
    for project in all_projects:
        if project_matches_query(project, q_lower):
            if project.id not in authorized_project_ids:
                role_label = "Project Managers" if caller_role == "pm" else "Team Members"
                denial = (
                    f"I cannot provide information regarding '{project.name}'. "
                    f"{role_label} are only permitted to view and query their own assigned projects. "
                    f"If you believe you should have access to this project, please consult your Organization Administrator."
                )
                return False, denial, [], []

    # 2. Check User-level Hierarchy RBAC
    matched_users = find_referenced_users(db, query_text)

    # A. User / Member restrictions: Can only know their own info
    if caller_level == 1:  # Member
        # Check if asked about higher-level roles generically
        generic_higher_roles = ["admin", "administrator", "project manager", "pms"]
        for hr in generic_higher_roles:
            if re.search(r'\b' + re.escape(hr) + r'\b', q_lower):
                # Allow question if asking who manages their assigned project (e.g. "who is the project manager for Project Alpha")
                is_pm_question_for_own_project = any(
                    phrase in q_lower for phrase in ["project manager for", "who is pm for", "who manages", "who is managing"]
                ) and any(project_matches_query(p, q_lower) for p in authorized_projects)

                if not is_pm_question_for_own_project:
                    denial = (
                        "Access Denied: As a Team Member, you can only access your own personal information, "
                        "time logs, and assigned projects. Inquiries regarding higher-level personnel "
                        "(Project Managers and Administrators) or other team members are restricted."
                    )
                    return False, denial, authorized_projects, []

        # Check if asking to list all users / directory
        if any(phrase in q_lower for phrase in ["list users", "all users", "show users", "show all members", "team list", "employee list"]):
            denial = (
                "Access Denied: Team Members are only permitted to query their own user account and hours. "
                "Company-wide user directories are restricted to Project Managers and Administrators."
            )
            return False, denial, authorized_projects, []

        # Check referenced users: Members CANNOT ask about other users
        for target_u in matched_users:
            if target_u.id != user.id:
                target_role = target_u.role.role_name if target_u.role else "member"
                target_level = ROLE_LEVELS.get(target_role, 1)
                level_desc = "higher-level " + target_role.upper() if target_level > 1 else "other team member"
                denial = (
                    f"Access Denied: I cannot provide information regarding '{target_u.full_name}' ({level_desc}). "
                    f"Team Members are only authorized to query their own personal records and assigned projects."
                )
                return False, denial, authorized_projects, []

    # B. PM restrictions: Can know their own info and users info, but CANNOT know Admin info or other PM info
    elif caller_level == 2:  # PM
        # Check generic admin inquiries
        if re.search(r'\b(admin|administrator|administrators)\b', q_lower):
            denial = (
                "Access Denied: As a Project Manager, you cannot access information regarding higher-level "
                "Administrators or organization-wide executive data. You may only view your own records "
                "and regular team members assigned to your projects."
            )
            return False, denial, authorized_projects, []

        # Check matched users: PM cannot query Admin or other PMs
        for target_u in matched_users:
            if target_u.id == user.id:
                continue
            target_role = target_u.role.role_name if target_u.role else "member"
            if target_role == "admin":
                denial = (
                    f"Access Denied: I cannot provide information regarding '{target_u.full_name}'. "
                    f"Project Managers are not authorized to query higher-level Administrator accounts. "
                    f"You may only query your own data and regular team members."
                )
                return False, denial, authorized_projects, []
            elif target_role == "pm":
                denial = (
                    f"Access Denied: I cannot provide information regarding Project Manager '{target_u.full_name}'. "
                    f"Project Managers can only query their own information and regular team members."
                )
                return False, denial, authorized_projects, []

    # C. Admin (Level 3): Full access to everyone (Members, PMs, Admins, all projects)

    return True, None, authorized_projects, matched_users

def build_knowledge_context(db: Session, projects: List[Project], user: User, matched_users: List[User]) -> str:
    """Builds a grounded text context containing project stats, hours, users, and punch sessions."""
    context_sections = []
    caller_role = user.role.role_name if user.role else "member"

    # 1. Caller User Summary
    user_section = f"""Current User Profile:
- Full Name: {user.full_name}
- Email: {user.email}
- Role: {caller_role.upper()}
- Active Status: {'Active' if user.is_active else 'Inactive'}
"""
    context_sections.append(user_section)

    # 2. Targeted Users Context (if authorized)
    for u in matched_users:
        if u.id != user.id:
            u_role = u.role.role_name if u.role else "member"
            total_hours = db.query(func.coalesce(func.sum(TimeEntry.hours), 0.0)).filter(
                TimeEntry.user_id == u.id, TimeEntry.is_deleted == False
            ).scalar()
            context_sections.append(
                f"Target User Record:\n- Name: {u.full_name}\n- Email: {u.email}\n- Role: {u_role}\n- Total Hours Logged (All Time): {float(total_hours):.2f} hrs"
            )

    # 3. Authorized Projects Context
    for p in projects:
        pm_name = p.assigned_pm.full_name if p.assigned_pm else (p.creator.full_name if p.creator else "Unassigned")
        members = [m.user.full_name for m in p.members if m.user]
        members_str = ", ".join(members) if members else "None currently assigned"

        entries = db.query(
            TimeEntry.date,
            TimeEntry.hours,
            TimeEntry.notes,
            User.full_name
        ).join(User, TimeEntry.user_id == User.id)\
         .filter(TimeEntry.project_id == p.id, TimeEntry.is_deleted == False).all()

        monthly_totals: Dict[str, float] = {}
        for entry_date, hours, notes, worker_name in entries:
            key = entry_date.strftime("%B %Y")
            monthly_totals[key] = monthly_totals.get(key, 0.0) + float(hours)

        monthly_summary = "; ".join([f"{m}: {hrs:.2f} hrs" for m, hrs in monthly_totals.items()]) or "No time logged yet"

        section = f"""Project: {p.name}
- Client: {p.client_name}
- Monthly Hour Cap: {float(p.monthly_hourly_cap):.0f} hrs/month
- Budget: ${float(p.budget) if p.budget else 0.0}
- Project Manager: {pm_name}
- Assigned Team Members: {members_str}
- Logged Hours By Month: {monthly_summary}
- Total Logged Hours (All Time): {sum(monthly_totals.values()):.2f} hrs
"""
        context_sections.append(section)

    return "\n---\n".join(context_sections)

async def ask_llm(context: str, query: str, user_name: str, role: str) -> Optional[str]:
    """Attempts to call Gemini API or OpenAI API if configured."""
    system_instruction = f"""You are an accurate, polite AI Assistant for an internal Project Management and Time Tracking platform.
Current User: {user_name} (Role: {role}).
You MUST answer questions strictly using the provided context. If asked about information not in the context, politely state that you do not have that data.
Never reveal data for projects or users not listed in the context.
Keep answers concise, direct, and professional."""

    # 1. Try Gemini if configured
    if settings.GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
            prompt = f"{system_instruction}\n\nContext:\n{context}\n\nUser Question:\n{query}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
                        if text:
                            return text
        except Exception:
            pass

    # 2. Try OpenAI if configured
    if settings.OPENAI_API_KEY:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"}
                ],
                "temperature": 0.2
            }
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    text = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                    if text:
                        return text
        except Exception:
            pass

    return None

def fallback_deterministic_rag_answer(
    db: Session,
    caller: User,
    authorized_projects: List[Project],
    matched_users: List[User],
    query: str
) -> str:
    """
    Deterministic Partial-RAG Engine:
    Understands the requirement, queries DB records, and formats structured responses
    without requiring third-party LLMs like Gemini or OpenAI.
    """
    q = query.lower()
    caller_role = caller.role.role_name if caller.role else "member"
    caller_level = ROLE_LEVELS.get(caller_role, 1)

    # -------------------------------------------------------------
    # 1. Self User Inquiries ("my info", "who am i", "my profile")
    # -------------------------------------------------------------
    if any(k in q for k in ["my info", "who am i", "my profile", "my account", "tell me about myself", "about me", "my role", "my email"]):
        # Fetch user's assigned/managed projects
        if caller_level == 3:  # Admin
            proj_desc = f"All {len(authorized_projects)} organization projects (Full Admin access)"
        elif caller_level == 2:  # PM
            proj_desc = f"{len(authorized_projects)} managed project(s): " + ", ".join([p.name for p in authorized_projects])
        else:  # Member
            proj_desc = f"{len(authorized_projects)} assigned project(s): " + (", ".join([p.name for p in authorized_projects]) if authorized_projects else "None")

        # Total hours logged by caller
        total_hrs = db.query(func.coalesce(func.sum(TimeEntry.hours), 0.0)).filter(
            TimeEntry.user_id == caller.id, TimeEntry.is_deleted == False
        ).scalar()

        # Punch session status
        active_punch = db.query(PunchSession).filter(
            PunchSession.user_id == caller.id, PunchSession.is_active == True
        ).first()
        punch_status = f"Clocked IN since {active_punch.start_time.strftime('%H:%M UTC')} on {active_punch.project.name}" if active_punch else "Currently Clocked OUT"

        return (
            f"### User Profile: {caller.full_name}\n"
            f"- **Email:** {caller.email}\n"
            f"- **Role:** {caller_role.upper()}\n"
            f"- **Status:** {'Active' if caller.is_active else 'Inactive'}\n"
            f"- **Projects:** {proj_desc}\n"
            f"- **Total Hours Logged (All Time):** {float(total_hrs):.1f} hrs\n"
            f"- **Punch Clock Status:** {punch_status}"
        )

    # -------------------------------------------------------------
    # 2. Punch Clock / Active Session Status ("punch status", "am i punched in")
    # -------------------------------------------------------------
    if any(k in q for k in ["punch status", "am i clocked in", "am i punched in", "my punch", "clock session", "active punch"]):
        active_punch = db.query(PunchSession).filter(
            PunchSession.user_id == caller.id, PunchSession.is_active == True
        ).first()
        if active_punch:
            elapsed = datetime.utcnow() - active_punch.start_time
            elapsed_hrs = elapsed.total_seconds() / 3600.0
            return (
                f"You are currently **Clocked IN** on **{active_punch.project.name}**.\n"
                f"- **Start Time:** {active_punch.start_time.strftime('%Y-%m-%d %H:%M:%S UTC')}\n"
                f"- **Elapsed Time:** {elapsed_hrs:.2f} hours\n"
                f"- **Notes:** {active_punch.notes or 'None'}"
            )
        else:
            last_punch = db.query(PunchSession).filter(
                PunchSession.user_id == caller.id, PunchSession.is_active == False
            ).order_by(PunchSession.start_time.desc()).first()
            last_text = f"Last clocked out on {last_punch.end_time.strftime('%Y-%m-%d %H:%M:%S UTC')}" if last_punch and last_punch.end_time else "No prior punch sessions."
            return f"You are currently **Clocked OUT**. ({last_text})"

    # -------------------------------------------------------------
    # 3. List All Users / Directory (Admin -> All, PM -> Members)
    # -------------------------------------------------------------
    is_directory_query = (
        any(k in q for k in ["list users", "all users", "show users", "who are the users", "list members", "directory", "show all"]) or
        (("users" in q or "members" in q or "team" in q or "employees" in q) and any(w in q for w in ["list", "show", "all", "directory", "who are", "system"]))
    )
    if is_directory_query:
        if caller_level == 2:  # PM
            # Show members assigned to PM's projects
            pm_project_ids = [p.id for p in authorized_projects]
            member_ids = db.query(ProjectMember.user_id).filter(ProjectMember.project_id.in_(pm_project_ids)).all()
            member_ids_list = {m[0] for m in member_ids}
            members = db.query(User).filter(User.id.in_(member_ids_list), User.is_deleted == False).all()
            member_lines = [f"• {m.full_name} ({m.email}) - Role: {m.role.role_name.upper() if m.role else 'MEMBER'}" for m in members]
            return f"### Team Members in Your Managed Projects ({len(members)}):\n" + ("\n".join(member_lines) if member_lines else "No members assigned yet.")
        elif caller_level == 3:  # Admin
            all_users = db.query(User).filter(User.is_deleted == False).all()
            lines = [f"• {u.full_name} ({u.email}) - Role: {u.role.role_name.upper() if u.role else 'UNKNOWN'}" for u in all_users]
            return f"### Organization Personnel Directory ({len(all_users)} Users):\n" + "\n".join(lines)

    # -------------------------------------------------------------
    # 4. Target Project & Timeframe Resolution
    # -------------------------------------------------------------
    matched_project = None
    for p in authorized_projects:
        if project_matches_query(p, q):
            matched_project = p
            break

    # If only one project is authorized and user asks generally, default to it
    if not matched_project and len(authorized_projects) == 1 and any(w in q for w in ["project", "hours", "cap", "spent"]):
        matched_project = authorized_projects[0]

    # Timeframe extraction (Month, Year)
    months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
    target_month_num = None
    target_month_name = None
    for idx, m in enumerate(months, 1):
        if m in q:
            target_month_num = idx
            target_month_name = m.capitalize()
            break

    year_match = re.search(r'\b(202\d)\b', q)
    target_year = int(year_match.group(1)) if year_match else datetime.now().year

    # -------------------------------------------------------------
    # 5. Inquiries About Other Users (PM querying Member, or Admin querying anyone)
    # -------------------------------------------------------------
    target_user: Optional[User] = None
    if matched_users:
        non_caller_users = [u for u in matched_users if u.id != caller.id]
        if non_caller_users:
            target_user = non_caller_users[0]
        elif matched_users:
            target_user = matched_users[0]

    if target_user and target_user.id != caller.id:
        t_role = target_user.role.role_name if target_user.role else "member"

        # Check if query is asking about hours logged by target user
        if any(k in q for k in ["hours", "time logged", "hours spent", "how many hours", "timesheet", "logged"]):
            query_filter = [TimeEntry.user_id == target_user.id, TimeEntry.is_deleted == False]
            period_desc = "all time"
            if target_month_num:
                query_filter.append(extract('month', TimeEntry.date) == target_month_num)
                query_filter.append(extract('year', TimeEntry.date) == target_year)
                period_desc = f"{target_month_name} {target_year}"
            elif "current month" in q or "this month" in q:
                now = datetime.now()
                query_filter.append(extract('month', TimeEntry.date) == now.month)
                query_filter.append(extract('year', TimeEntry.date) == now.year)
                period_desc = f"{now.strftime('%B %Y')}"

            if matched_project:
                query_filter.append(TimeEntry.project_id == matched_project.id)
                period_desc += f" on {matched_project.name}"

            user_hrs = db.query(func.coalesce(func.sum(TimeEntry.hours), 0.0)).filter(*query_filter).scalar()
            return f"{target_user.full_name} logged **{float(user_hrs):.1f} hours** in {period_desc}."

        # Otherwise return general personnel record
        if t_role == "member":
            memberships = db.query(ProjectMember).filter(ProjectMember.user_id == target_user.id).all()
            assigned_projs = [m.project.name for m in memberships if m.project]
            proj_str = ", ".join(assigned_projs) if assigned_projs else "None"
        elif t_role == "pm":
            managed = db.query(Project).filter((Project.created_by == target_user.id) | (Project.assigned_pm_id == target_user.id)).all()
            proj_str = ", ".join([p.name for p in managed]) if managed else "None"
        else:
            proj_str = "All organization projects (Admin)"

        total_hrs = db.query(func.coalesce(func.sum(TimeEntry.hours), 0.0)).filter(
            TimeEntry.user_id == target_user.id, TimeEntry.is_deleted == False
        ).scalar()

        return (
            f"### Personnel Record: {target_user.full_name}\n"
            f"- **Email:** {target_user.email}\n"
            f"- **Role:** {t_role.upper()}\n"
            f"- **Account Status:** {'Active' if target_user.is_active else 'Inactive'}\n"
            f"- **Associated Projects:** {proj_str}\n"
            f"- **Total Hours Logged (All Time):** {float(total_hrs):.1f} hrs"
        )

    # -------------------------------------------------------------
    # 6. Personal Hours Query ("my hours", "how many hours have I logged")
    # -------------------------------------------------------------
    if any(k in q for k in ["my hours", "hours logged by me", "have i logged", "my time logged", "how many hours did i log"]):
        query_filter = [TimeEntry.user_id == caller.id, TimeEntry.is_deleted == False]
        period_desc = "all time"

        if target_month_num:
            query_filter.append(extract('month', TimeEntry.date) == target_month_num)
            query_filter.append(extract('year', TimeEntry.date) == target_year)
            period_desc = f"{target_month_name} {target_year}"
        elif "current month" in q or "this month" in q:
            now = datetime.now()
            query_filter.append(extract('month', TimeEntry.date) == now.month)
            query_filter.append(extract('year', TimeEntry.date) == now.year)
            period_desc = f"{now.strftime('%B %Y')}"

        if matched_project:
            query_filter.append(TimeEntry.project_id == matched_project.id)
            period_desc += f" on {matched_project.name}"

        total_my_hrs = db.query(func.coalesce(func.sum(TimeEntry.hours), 0.0)).filter(*query_filter).scalar()
        return f"You logged a total of **{float(total_my_hrs):.1f} hours** in {period_desc}."

    # -------------------------------------------------------------
    # 7. Project Manager Questions ("who is project manager", "who is pm")
    # -------------------------------------------------------------
    if any(k in q for k in ["project manager", "who is pm", "who is managing", "pm for"]):
        if matched_project:
            pm = matched_project.assigned_pm or matched_project.creator
            pm_name = pm.full_name if pm else "Not assigned"
            return f"The Project Manager for {matched_project.name} is {pm_name}."
        else:
            pms = [f"{p.name}: {p.assigned_pm.full_name if p.assigned_pm else 'Unassigned'}" for p in authorized_projects]
            return "Here are the Project Managers for your authorized projects:\n" + "\n".join(f"- {p}" for p in pms)

    # -------------------------------------------------------------
    # 8. Hours Spent / Time Logged on Project (or by a specific User on Project)
    # -------------------------------------------------------------
    if any(k in q for k in ["how many hours", "hours spent", "time logged", "hours"]):
        # A. If target user specified (e.g. "hours logged by Harsh Patel on Project Alpha")
        if target_user and matched_project:
            query_filter = [
                TimeEntry.project_id == matched_project.id,
                TimeEntry.user_id == target_user.id,
                TimeEntry.is_deleted == False
            ]
            period_desc = "all time"
            if target_month_num:
                query_filter.append(extract('month', TimeEntry.date) == target_month_num)
                query_filter.append(extract('year', TimeEntry.date) == target_year)
                period_desc = f"{target_month_name} {target_year}"
            user_hrs = db.query(func.coalesce(func.sum(TimeEntry.hours), 0.0)).filter(*query_filter).scalar()
            return f"{target_user.full_name} logged **{float(user_hrs):.1f} hours** on {matched_project.name} in {period_desc}."

        # B. Overall project hours
        if matched_project:
            query_filter = [TimeEntry.project_id == matched_project.id, TimeEntry.is_deleted == False]
            period_desc = "all time"

            if target_month_num:
                query_filter.append(extract('month', TimeEntry.date) == target_month_num)
                query_filter.append(extract('year', TimeEntry.date) == target_year)
                period_desc = f"{target_month_name} {target_year}"
            elif "current month" in q or "this month" in q:
                now = datetime.now()
                query_filter.append(extract('month', TimeEntry.date) == now.month)
                query_filter.append(extract('year', TimeEntry.date) == now.year)
                period_desc = f"{now.strftime('%B %Y')}"

            total = db.query(func.coalesce(func.sum(TimeEntry.hours), 0.0)).filter(*query_filter).scalar()
            total_hours = float(total)
            cap = float(matched_project.monthly_hourly_cap)
            return (
                f"A total of {total_hours:.1f} hours were logged on {matched_project.name} in {period_desc}. "
                f"(Monthly Hour Cap: {cap:.0f} hrs)."
            )

    # -------------------------------------------------------------
    # 9. Monthly Cap / Budget Questions
    # -------------------------------------------------------------
    if any(k in q for k in ["cap", "limit", "budget"]):
        if matched_project:
            return f"The monthly hour cap for {matched_project.name} is {float(matched_project.monthly_hourly_cap):.0f} hours."

    # -------------------------------------------------------------
    # 10. Team Members Assigned to Project
    # -------------------------------------------------------------
    if any(k in q for k in ["members", "who is assigned", "team", "roster"]):
        if matched_project:
            member_names = [m.user.full_name for m in matched_project.members if m.user]
            if member_names:
                return f"The following members are assigned to {matched_project.name}: {', '.join(member_names)}."
            return f"There are no members currently assigned to {matched_project.name}."

    # -------------------------------------------------------------
    # 11. Default Summary of Authorized Projects
    # -------------------------------------------------------------
    if not authorized_projects:
        return "You do not currently have access to any projects in the system."

    summary_lines = []
    for p in authorized_projects:
        summary_lines.append(f"• {p.name} (Client: {p.client_name}, Cap: {float(p.monthly_hourly_cap):.0f} hrs/mo)")

    role_scope_hint = (
        "As an Administrator, you have complete visibility over all system users and projects."
        if caller_level == 3 else
        "As a Project Manager, you can query your managed projects and assigned team members."
        if caller_level == 2 else
        "As a Team Member, you can query your personal hours, profile, and assigned projects."
    )

    return (
        f"You have access to {len(authorized_projects)} project(s):\n"
        + "\n".join(summary_lines)
        + f"\n\n{role_scope_hint}\n"
        + "You can ask about logged hours, monthly caps, assigned project managers, personal timesheets, or punch status."
    )

async def process_rag_query(db: Session, user: User, query: str) -> Dict[str, Any]:
    """
    Main RBAC-Guarded Partial-RAG Pipeline:
    1. Requirement understanding & semantic entity extraction.
    2. Strict Pre-retrieval RBAC Gatekeeper (Enforcing Member -> Self only, PM -> Self + Users, Admin -> Everyone).
    3. Targeted DB record retrieval.
    4. Grounded Context Construction.
    5. Partial RAG Generation (LLM if configured, else deterministic DB synthesis).
    """
    is_allowed, denial_reason, authorized_projects, matched_users = check_rbac_permission_for_query(db, user, query)

    # 1. Strict RBAC Enforcement: Polite Denial
    if not is_allowed:
        referenced_proj_names = [p.name for p in db.query(Project).all() if project_matches_query(p, query.lower())]
        return {
            "query": query,
            "answer": denial_reason or "Access Denied: You do not have permission to view the requested resource.",
            "is_allowed": False,
            "referenced_projects": referenced_proj_names
        }

    # 2. Build Grounded Context from DB records
    context = build_knowledge_context(db, authorized_projects, user, matched_users)
    user_role = user.role.role_name if user.role else "member"

    # 3. Generation: Try external LLM (Gemini / OpenAI) first
    answer = await ask_llm(context, query, user.full_name, user_role)

    # 4. If LLM is not configured or call fails (e.g. invalid key/offline), use the Deterministic Partial-RAG Engine
    if not answer:
        answer = fallback_deterministic_rag_answer(db, user, authorized_projects, matched_users, query)

    referenced = [p.name for p in authorized_projects if project_matches_query(p, query.lower())]

    return {
        "query": query,
        "answer": answer,
        "is_allowed": True,
        "referenced_projects": referenced
    }
