export interface User {
  id: number;
  email: string;
  full_name: string;
  role_id: number;
  role_name: string;
  is_active: boolean;
  created_at: string;
}

export interface ProjectMember {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  role_name: string;
  assigned_at: string;
}

export interface Project {
  id: number;
  name: string;
  client_name: string;
  monthly_hourly_cap: number;
  budget?: number | null;
  created_by?: number;
  assigned_pm_id?: number | null;
  assigned_pm_name?: string | null;
  created_at: string;
  current_month_hours: number;
  cap_percentage: number;
  cap_status: "normal" | "warning" | "over_cap";
  assigned_members_count: number;
  members: ProjectMember[];
}

export interface TimeEntry {
  id: number;
  project_id: number;
  project_name: string;
  client_name: string;
  user_id: number;
  user_name: string;
  date: string;
  hours: number;
  notes?: string | null;
  created_at: string;
}

export interface PunchSession {
  id: number;
  user_id: number;
  user_name: string;
  project_id: number;
  project_name: string;
  client_name: string;
  start_time: string;
  end_time?: string | null;
  duration_hours: number;
  is_active: boolean;
  notes?: string | null;
}

export interface DailyPunchSummary {
  date: string;
  total_hours_logged: number;
  active_session?: PunchSession | null;
  sessions: PunchSession[];
}

export interface HeatmapMonth {
  month: number;
  year: number;
  month_name: string;
  logged_hours: number;
  monthly_cap: number;
  percentage: number;
  status: "normal" | "warning" | "over_cap";
}

export interface ProjectAnnualHeatmap {
  project_id: number;
  project_name: string;
  client_name: string;
  year: number;
  monthly_hourly_cap: number;
  months: HeatmapMonth[];
}

export interface UserMonthMetric {
  month: number;
  year: number;
  month_name: string;
  logged_hours: number;
  monthly_cap: number;
  cap_utilization: number;
  status: "normal" | "warning" | "over_cap";
}

export interface UserProjectMetrics {
  user_id: number;
  user_name: string;
  user_email: string;
  project_id: number;
  project_name: string;
  client_name: string;
  monthly_hourly_cap: number;
  current_month_hours: number;
  current_month_utilization: number;
  total_year_hours: number;
  months: UserMonthMetric[];
}

export interface AIQueryResponse {
  query: string;
  answer: string;
  is_allowed: boolean;
  referenced_projects: string[];
}

export interface AuditLog {
  id: number;
  user_id?: number | null;
  user_email?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_values?: any;
  new_values?: any;
  ip_address?: string | null;
  created_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  customToken?: string | null
): Promise<T> {
  const token =
    customToken ??
    (typeof window !== "undefined" ? localStorage.getItem("auth_token") : null);

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const normalizedBase = API_BASE.replace(/\/+$/, "");
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith("http://") || endpoint.startsWith("https://")
    ? endpoint
    : `${normalizedBase}${normalizedEndpoint}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errorData = await res.json();
      if (typeof errorData?.detail === "string") {
        errorMessage = errorData.detail;
      } else if (Array.isArray(errorData?.detail)) {
        errorMessage = errorData.detail
          .map((d: any) => d.msg || JSON.stringify(d))
          .join(", ");
      } else if (errorData?.detail) {
        errorMessage = JSON.stringify(errorData.detail);
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // response was not JSON
    }
    throw new Error(errorMessage);
  }

  if (res.status === 204) {
    return {} as T;
  }

  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return (await res.json()) as T;
  }

  const text = await res.text();
  try {
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    return text as unknown as T;
  }
}
