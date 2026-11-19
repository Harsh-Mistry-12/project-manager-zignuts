from datetime import datetime, date
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, EmailStr, Field

# ----------------- Auth & Users -----------------
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=2)
    role_name: Optional[str] = "member"  # 'admin', 'pm', 'member'

class UserRoleUpdate(BaseModel):
    role_name: Optional[str] = None
    is_active: Optional[bool] = None

class RoleResponse(BaseModel):
    id: int
    role_name: str

    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role_id: int
    role_name: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# ----------------- Projects -----------------
class ProjectCreate(BaseModel):
    name: str
    client_name: str
    monthly_hourly_cap: float = 160.0
    budget: Optional[float] = None
    assigned_pm_id: Optional[int] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    client_name: Optional[str] = None
    monthly_hourly_cap: Optional[float] = None
    budget: Optional[float] = None
    assigned_pm_id: Optional[int] = None

class ProjectMemberAssign(BaseModel):
    user_ids: List[int]

class ProjectMemberResponse(BaseModel):
    id: int
    user_id: int
    full_name: str
    email: str
    role_name: str
    assigned_at: datetime

    class Config:
        from_attributes = True

class ProjectResponse(BaseModel):
    id: int
    name: str
    client_name: str
    monthly_hourly_cap: float
    budget: Optional[float] = None
    created_by: int
    assigned_pm_id: Optional[int] = None
    assigned_pm_name: Optional[str] = None
    created_at: datetime
    current_month_hours: float = 0.0
    cap_percentage: float = 0.0
    cap_status: str = "normal"  # 'normal', 'warning', 'over_cap'
    assigned_members_count: int = 0
    members: List[ProjectMemberResponse] = []

    class Config:
        from_attributes = True

# ----------------- Time Entries -----------------
class TimeEntryCreate(BaseModel):
    project_id: int
    date: date
    hours: float = Field(gt=0, le=24)
    notes: Optional[str] = None

class TimeEntryUpdate(BaseModel):
    date: Optional[date] = None
    hours: Optional[float] = Field(None, gt=0, le=24)
    notes: Optional[str] = None

class TimeEntryResponse(BaseModel):
    id: int
    project_id: int
    project_name: str
    client_name: str
    user_id: int
    user_name: str
    date: date
    hours: float
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# ----------------- Punch Sessions -----------------
class PunchInRequest(BaseModel):
    project_id: int
    notes: Optional[str] = None

class PunchOutRequest(BaseModel):
    notes: Optional[str] = None

class PunchSessionResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    project_id: int
    project_name: str
    client_name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_hours: float = 0.0
    is_active: bool
    notes: Optional[str] = None

    class Config:
        from_attributes = True

class DailyPunchSummary(BaseModel):
    date: date
    total_hours_logged: float
    active_session: Optional[PunchSessionResponse] = None
    sessions: List[PunchSessionResponse] = []

# ----------------- Heatmap & Stats -----------------
class HeatmapMonth(BaseModel):
    month: int
    year: int
    month_name: str
    logged_hours: float
    monthly_cap: float
    percentage: float
    status: str  # 'normal', 'warning', 'over_cap'

class ProjectAnnualHeatmap(BaseModel):
    project_id: int
    project_name: str
    client_name: str
    year: int
    monthly_hourly_cap: float
    months: List[HeatmapMonth]

# ----------------- AI Assistant (RAG) -----------------
class AIQueryRequest(BaseModel):
    query: str

class AIQueryResponse(BaseModel):
    query: str
    answer: str
    is_allowed: bool
    referenced_projects: List[str] = []

# ----------------- Audit Logs -----------------
class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    user_email: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    old_values: Optional[Any] = None
    new_values: Optional[Any] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

