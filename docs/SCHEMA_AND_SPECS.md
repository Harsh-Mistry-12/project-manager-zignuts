# Project Management & Time Tracking App - System Architecture & Schema

## Overview
This document specifies the complete production-grade architecture, database schema, role-based access rules, and component implementation plan for the Project Management & Time Tracking App.

---

## 1. Database Schema (MySQL 8.0)

### 1.1 `roles`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INT | PK, AUTO_INCREMENT | 1 = Admin, 2 = PM, 3 = Member/Employee |
| `role_name` | VARCHAR(50) | UNIQUE, NOT NULL | Role identifier ('admin', 'pm', 'member') |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Timestamp |

### 1.2 `users`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INT | PK, AUTO_INCREMENT | User ID |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL, INDEX | Login email |
| `password_hash` | VARCHAR(255) | NOT NULL | Bcrypt / Argon2 hashed password |
| `full_name` | VARCHAR(255) | NOT NULL | Full display name |
| `role_id` | INT | FK -> `roles.id`, NOT NULL | Assigned role |
| `is_active` | BOOLEAN | DEFAULT TRUE | Admin approval status (false = pending) |
| `is_deleted` | BOOLEAN | DEFAULT FALSE | Soft delete flag |
| `deleted_at` | DATETIME | NULLABLE | Soft delete timestamp |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Registration date |

### 1.3 `projects`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INT | PK, AUTO_INCREMENT | Project ID |
| `name` | VARCHAR(255) | NOT NULL | Project Name |
| `client_name` | VARCHAR(255) | NOT NULL | Client organization name |
| `monthly_hourly_cap` | DECIMAL(10, 2) | NOT NULL, DEFAULT 160.00 | Monthly retainer cap in hours |
| `budget` | DECIMAL(12, 2) | NULLABLE | Monthly financial budget |
| `created_by` | INT | FK -> `users.id`, NOT NULL | PM or Admin who created the project |
| `assigned_pm_id` | INT | FK -> `users.id`, NULLABLE | Assigned PM manager |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

### 1.4 `project_members`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INT | PK, AUTO_INCREMENT | Assignment ID |
| `project_id` | INT | FK -> `projects.id`, NOT NULL | Project reference |
| `user_id` | INT | FK -> `users.id`, NOT NULL | Member reference |
| `assigned_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Date assigned |
*UNIQUE KEY: (`project_id`, `user_id`)*

### 1.5 `time_entries`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INT | PK, AUTO_INCREMENT | Entry ID |
| `project_id` | INT | FK -> `projects.id`, NOT NULL | Project reference |
| `user_id` | INT | FK -> `users.id`, NOT NULL | User who performed work |
| `date` | DATE | NOT NULL, INDEX | Work date |
| `hours` | DECIMAL(5, 2) | NOT NULL | Hours logged (e.g. 7.50) |
| `notes` | TEXT | NULLABLE | Work description notes |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Update timestamp |
| `updated_by` | INT | FK -> `users.id`, NULLABLE | Last modifier |
| `is_deleted` | BOOLEAN | DEFAULT FALSE | Soft delete flag |
| `deleted_at` | DATETIME | NULLABLE | Soft delete timestamp |

### 1.6 `punch_sessions`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INT | PK, AUTO_INCREMENT | Session ID |
| `user_id` | INT | FK -> `users.id`, NOT NULL | User punching |
| `project_id` | INT | FK -> `projects.id`, NOT NULL | Selected assigned project |
| `start_time` | DATETIME | NOT NULL | Punch In time |
| `end_time` | DATETIME | NULLABLE | Punch Out time |
| `is_active` | BOOLEAN | DEFAULT TRUE | True while punch session is ongoing |
| `notes` | TEXT | NULLABLE | Work notes entered at punch out |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

### 1.7 `audit_logs` (Standard Production Architecture)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT | Audit Log ID |
| `user_id` | INT | FK -> `users.id`, NULLABLE | Actor ID |
| `action` | VARCHAR(100) | NOT NULL, INDEX | Action performed (e.g. "PUNCH_IN", "TIME_ENTRY_CREATED") |
| `entity_type` | VARCHAR(50) | NOT NULL, INDEX | Target entity ("Project", "TimeEntry", "PunchSession", "RAG") |
| `entity_id` | VARCHAR(100) | NULLABLE | ID of target entity |
| `old_values` | JSON | NULLABLE | Pre-mutation state |
| `new_values` | JSON | NULLABLE | Post-mutation state |
| `ip_address` | VARCHAR(45) | NULLABLE | Client IP address |
| `user_agent` | VARCHAR(255) | NULLABLE | Client User-Agent string |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP, INDEX | Action timestamp |

---

## 2. RBAC Enforcement Matrix

| Feature / Action | Admin | PM | Member / Employee |
|---|---|---|---|
| User Approval / Role Management | Full Access | No | No |
| Global Projects Overview | Full Access | No | No |
| PM Project Listing (Sec 1) | Full Access | Own / Assigned Projects | No |
| Project Details & Assigned Members (Sec 2) | Full Access | Own / Assigned Projects | Assigned Projects Only |
| Annual Heatmap Matrix (Sec 3) | Full Access | Own / Assigned Projects | No |
| PM Member Allocation (Sec 4) | Full Access | Assign to Own Projects | No |
| Punch In / Out (Assigned Projects only) | Full Access | Allowed | Allowed |
| Manual Time Logging (Assigned Projects) | Full Access | Allowed | Allowed |
| Daily Punch Log & Hours View | Full Access | Own logs | Own logs |
| AI Assistant (RAG) | All Projects & Logs | Own Managed Projects | Assigned Projects Only |

