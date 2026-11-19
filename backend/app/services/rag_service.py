import re
import calendar
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.models import Project, ProjectMember, TimeEntry, User
from app.core.config import settings

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
        ).subquery()
        return db.query(Project).filter(Project.id.in_(assigned_project_ids)).all()

def project_name_matches(project_name: str, query_lower: str) -> bool:
    """Checks if project name, base name, or client name is mentioned in the query."""
    p_full = project_name.lower()
    # e.g., "project alpha (fintech app)" -> "project alpha", "alpha"
    base_name = p_full.split("(")[0].strip()
    parentheses_part = p_full.split("(")[1].replace(")", "").strip() if "(" in p_full else ""

    candidates = [p_full, base_name]
    if parentheses_part:
        candidates.append(parentheses_part)

    for c in candidates:
        if len(c) > 2 and (c in query_lower or re.search(r'\b' + re.escape(c) + r'\b', query_lower)):
            return True
    return False

def check_rbac_permission_for_query(
    db: Session, user: User, query_text: str
) -> Tuple[bool, Optional[str], List[Project]]:
    """
    Scans the query against all projects in the database.
    If the user mentions or asks about a project they do NOT have permission for,
    returns (False, project_name, []).
    Otherwise returns (True, None, authorized_projects).
    """
    all_projects = db.query(Project).all()
    authorized_projects = get_authorized_projects(db, user)
    authorized_ids = {p.id for p in authorized_projects}

    query_lower = query_text.lower()

    # Check if query references any unauthorized project
    for project in all_projects:
        if project_name_matches(project.name, query_lower):
            if project.id not in authorized_ids:
                return False, project.name, []

    return True, None, authorized_projects

def build_knowledge_context(db: Session, projects: List[Project], user: User) -> str:
    """Builds a grounded text context containing project stats, hours by month, PMs, and members."""
    context_sections = []

    for p in projects:
        pm_name = p.assigned_pm.full_name if p.assigned_pm else (p.creator.full_name if p.creator else "Unassigned")
        members = [m.user.full_name for m in p.members if m.user]
        members_str = ", ".join(members) if members else "None currently assigned"

        # Query all time entries for this project
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
- Monthly Hour Cap: {float(p.monthly_hourly_cap)} hrs/month
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
Never reveal data for projects not listed in the context.
Keep answers concise, direct, and professional."""

    # 1. Try Gemini if configured
    if settings.GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
            prompt = f"{system_instruction}\n\nContext:\n{context}\n\nUser Question:\n{query}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        return candidates[0]["content"]["parts"][0]["text"].strip()
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
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    return data["choices"][0]["message"]["content"].strip()
        except Exception:
            pass

    return None

def fallback_deterministic_rag_answer(db: Session, projects: List[Project], query: str) -> str:
    """
    Deterministic NLP & RAG fallback engine when no third-party API key is present.
    Accurately handles hours spent, PM inquiries, caps, team members, etc.
    """
    q = query.lower()

    if not projects:
        return "You do not currently have access to any projects in the system."

    # Identify which authorized project the user is querying
    matched_project = None
    for p in projects:
        if project_name_matches(p.name, q):
            matched_project = p
            break

    # If only one authorized project exists and none matched explicitly, use that project
    if not matched_project and len(projects) == 1:
        matched_project = projects[0]

    # Check for Month/Year query (e.g. "January 2026", "this month")
    months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
    target_month_num = None
    target_month_name = None
    for idx, m in enumerate(months, 1):
        if m in q:
            target_month_num = idx
            target_month_name = m.capitalize()
            break

    # Look for year (e.g. 2025, 2026)
    year_match = re.search(r'\b(202\d)\b', q)
    target_year = int(year_match.group(1)) if year_match else datetime.now().year

    # 1. Project Manager questions
    if "project manager" in q or "who is pm" in q or "who is managing" in q:
        if matched_project:
            pm = matched_project.assigned_pm or matched_project.creator
            pm_name = pm.full_name if pm else "Not assigned"
            return f"The Project Manager for {matched_project.name} is {pm_name}."
        else:
            pms = [f"{p.name}: {p.assigned_pm.full_name if p.assigned_pm else 'Unassigned'}" for p in projects]
            return "Here are the Project Managers for your authorized projects:\n" + "\n".join(f"- {p}" for p in pms)

    # 2. Hours spent / Time logged questions
    if "how many hours" in q or "hours spent" in q or "time logged" in q or "hours" in q:
        if matched_project:
            query_filter = [TimeEntry.project_id == matched_project.id, TimeEntry.is_deleted == False]
            period_desc = "all time"

            if target_month_num:
                query_filter.append(func.extract('month', TimeEntry.date) == target_month_num)
                query_filter.append(func.extract('year', TimeEntry.date) == target_year)
                period_desc = f"{target_month_name} {target_year}"
            elif "current month" in q or "this month" in q:
                now = datetime.now()
                query_filter.append(func.extract('month', TimeEntry.date) == now.month)
                query_filter.append(func.extract('year', TimeEntry.date) == now.year)
                period_desc = f"{now.strftime('%B %Y')}"

            total = db.query(func.coalesce(func.sum(TimeEntry.hours), 0.0)).filter(*query_filter).scalar()
            total_hours = float(total)
            cap = float(matched_project.monthly_hourly_cap)
            return (
                f"A total of {total_hours:.1f} hours were logged on {matched_project.name} in {period_desc}. "
                f"(Monthly Hour Cap: {cap:.0f} hrs)."
            )

    # 3. Monthly cap questions
    if "cap" in q or "limit" in q or "budget" in q:
        if matched_project:
            return f"The monthly hour cap for {matched_project.name} is {float(matched_project.monthly_hourly_cap):.0f} hours."

    # 4. Team members questions
    if "members" in q or "who is assigned" in q or "team" in q:
        if matched_project:
            member_names = [m.user.full_name for m in matched_project.members if m.user]
            if member_names:
                return f"The following members are assigned to {matched_project.name}: {', '.join(member_names)}."
            return f"There are no members currently assigned to {matched_project.name}."

    # Default summary of authorized projects
    summary_lines = []
    for p in projects:
        summary_lines.append(f"• {p.name} (Client: {p.client_name}, Cap: {float(p.monthly_hourly_cap):.0f} hrs/mo)")
    return (
        f"You have access to {len(projects)} project(s):\n"
        + "\n".join(summary_lines)
        + "\n\nYou can ask about logged hours, monthly caps, assigned project managers, or team members."
    )

async def process_rag_query(db: Session, user: User, query: str) -> Dict[str, Any]:
    """Main RBAC-guarded RAG entrypoint."""
    is_allowed, denied_project_name, authorized_projects = check_rbac_permission_for_query(db, user, query)

    # Strict RBAC enforcement: Polite Denial
    if not is_allowed:
        role_label = "Project Managers" if user.role and user.role.role_name == "pm" else "Team Members"
        denial_message = (
            f"I cannot provide information regarding '{denied_project_name}'. "
            f"{role_label} are only permitted to view and query their own assigned projects. "
            f"If you believe you should have access to this project, please consult your Organization Administrator."
        )
        return {
            "query": query,
            "answer": denial_message,
            "is_allowed": False,
            "referenced_projects": [denied_project_name] if denied_project_name else []
        }

    # User is authorized - retrieve context
    context = build_knowledge_context(db, authorized_projects, user)
    user_role = user.role.role_name if user.role else "member"

    # Try external LLM first
    answer = await ask_llm(context, query, user.full_name, user_role)

    # If no LLM configured or call fails, use the grounded deterministic RAG solver
    if not answer:
        answer = fallback_deterministic_rag_answer(db, authorized_projects, query)

    referenced = [p.name for p in authorized_projects if p.name.lower() in query.lower()]

    return {
        "query": query,
        "answer": answer,
        "is_allowed": True,
        "referenced_projects": referenced
    }
