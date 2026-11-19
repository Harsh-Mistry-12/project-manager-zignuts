"use client";

import React, { useState, useEffect } from "react";
import { Project, User, AuditLog, apiFetch } from "@/lib/api";
import {
  ShieldCheck,
  Users,
  Briefcase,
  AlertTriangle,
  CheckCircle,
  FileText,
  Clock,
  TrendingUp,
  Check,
  X,
  RefreshCw,
  Plus,
  UserPlus,
  Settings2,
} from "lucide-react";

export default function AdminPanel() {
  const [activeSubTab, setActiveSubTab] = useState<"projects" | "users" | "audit">("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [statsSummary, setStatsSummary] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Create Project Modal state (Admin)
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newMonthlyCap, setNewMonthlyCap] = useState(160);
  const [newBudget, setNewBudget] = useState<number | "">("");
  const [newAssignedPmId, setNewAssignedPmId] = useState<number | "">("");
  const [newSelectedMemberIds, setNewSelectedMemberIds] = useState<number[]>([]);

  // Edit PM & Team Modal state (Admin)
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editPmId, setEditPmId] = useState<number | "">("");
  const [editMemberIds, setEditMemberIds] = useState<number[]>([]);

  // Create User Modal state (Admin)
  const [showCreateUserModal, setShowCreateUserModal] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("Password123!");
  const [newUserRole, setNewUserRole] = useState("pm");

  const loadData = async () => {
    setLoading(true);
    try {
      const [projData, usersData, statsData, logsData] = await Promise.all([
        apiFetch<Project[]>("/projects"),
        apiFetch<User[]>("/users"),
        apiFetch<any>("/stats/summary"),
        apiFetch<AuditLog[]>("/audit-logs?limit=40"),
      ]);
      setProjects(projData);
      setUsers(usersData);
      setStatsSummary(statsData);
      setAuditLogs(logsData);

      // Default PM to first available PM
      const pms = usersData.filter((u) => u.role_name === "pm" || u.role_name === "admin");
      if (pms.length > 0 && newAssignedPmId === "") {
        setNewAssignedPmId(pms[0].id);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleUserStatus = async (user: User) => {
    try {
      const updated = await apiFetch<User>(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      setUsers(users.map((u) => (u.id === user.id ? updated : u)));
      setMsg({
        type: "success",
        text: `User ${updated.full_name} is now ${updated.is_active ? "Approved / Active" : "Deactivated"}.`,
      });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to update user status" });
    }
  };

  const handleChangeUserRole = async (user: User, newRole: string) => {
    try {
      const updated = await apiFetch<User>(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role_name: newRole }),
      });
      setUsers(users.map((u) => (u.id === user.id ? updated : u)));
      setMsg({
        type: "success",
        text: `Role for ${updated.full_name} updated to ${updated.role_name.toUpperCase()}.`,
      });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to update user role" });
    }
  };

  // Admin Create PM or User
  const handleAdminCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const created = await apiFetch<User>("/users", {
        method: "POST",
        body: JSON.stringify({
          full_name: newUserName,
          email: newUserEmail,
          password: newUserPassword || undefined,
          role_name: newUserRole,
        }),
      });
      setMsg({
        type: "success",
        text: `User "${created.full_name}" created with role ${created.role_name.toUpperCase()}!`,
      });
      setShowCreateUserModal(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("Password123!");
      setNewUserRole("pm");
      await loadData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to create user" });
    } finally {
      setLoading(false);
    }
  };

  // Admin Create Project with PM & Members
  const handleAdminCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const created = await apiFetch<Project>("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: newProjectName,
          client_name: newClientName,
          monthly_hourly_cap: Number(newMonthlyCap),
          budget: newBudget ? Number(newBudget) : undefined,
          assigned_pm_id: newAssignedPmId ? Number(newAssignedPmId) : undefined,
          member_ids: newSelectedMemberIds,
        }),
      });
      setMsg({
        type: "success",
        text: `Project "${created.name}" created successfully with PM and ${newSelectedMemberIds.length} assigned member(s)!`,
      });
      setShowCreateModal(false);
      setNewProjectName("");
      setNewClientName("");
      setNewMonthlyCap(160);
      setNewBudget("");
      setNewSelectedMemberIds([]);
      await loadData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to create project" });
    } finally {
      setLoading(false);
    }
  };

  // Open Edit PM & Members Modal
  const openEditProjectModal = (proj: Project) => {
    setEditingProject(proj);
    setEditPmId(proj.assigned_pm_id || "");
    setEditMemberIds(proj.members.map((m) => m.user_id));
  };

  // Save Edit PM & Members
  const handleSaveProjectEdits = async () => {
    if (!editingProject) return;
    setLoading(true);
    setMsg(null);
    try {
      // 1. Update PM if changed
      if (editPmId !== editingProject.assigned_pm_id) {
        await apiFetch<Project>(`/projects/${editingProject.id}`, {
          method: "PUT",
          body: JSON.stringify({ assigned_pm_id: Number(editPmId) }),
        });
      }
      // 2. Update member assignments
      await apiFetch<Project>(`/projects/${editingProject.id}/members`, {
        method: "POST",
        body: JSON.stringify({ user_ids: editMemberIds }),
      });

      setMsg({
        type: "success",
        text: `Project "${editingProject.name}" PM & team allocations updated!`,
      });
      setEditingProject(null);
      await loadData();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to update project assignments" });
    } finally {
      setLoading(false);
    }
  };

  // Filtered staff lists
  const availablePMs = users.filter(
    (u) => (u.role_name === "pm" || u.role_name === "admin") && u.is_active
  );
  const availableMembers = users.filter(
    (u) => u.role_name === "member" && u.is_active
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-purple-600" />
              Organization Administration
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Create and assign projects to PMs, allocate team members, monitor retainer caps, and view audit trail.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="py-2 px-3.5 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 transition shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Project</span>
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            <div className="bg-slate-100 p-1 rounded-xl flex overflow-x-auto text-xs font-semibold max-w-full">
              <button
                onClick={() => setActiveSubTab("projects")}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                  activeSubTab === "projects"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Projects & Caps
              </button>
              <button
                onClick={() => setActiveSubTab("users")}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                  activeSubTab === "users"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Staff Access & Approvals
              </button>
              <button
                onClick={() => setActiveSubTab("audit")}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                  activeSubTab === "audit"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Audit Trail
              </button>
            </div>
          </div>
        </div>

        {msg && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 border ${
              msg.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {msg.type === "success" ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Projects
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">
            {statsSummary?.total_projects || projects.length}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Active client retainers</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Logged This Month
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">
            {statsSummary?.total_hours_this_month || 0} hrs
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            {statsSummary?.current_month_name || "Current Month"}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
              Warning Caps (≥90%)
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-700">
            {statsSummary?.warning_cap_projects || 0}
          </div>
          <span className="text-xs text-amber-600/80 mt-1 block">Within 10% of monthly cap</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
              Over Cap (&gt;100%)
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-red-700">
            {statsSummary?.over_cap_projects || 0}
          </div>
          <span className="text-xs text-red-600/80 mt-1 block">Requires budget adjustment</span>
        </div>
      </div>

      {/* Subtab 1: All Projects & Time Logged vs Cap */}
      {activeSubTab === "projects" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Admin Overview: Projects & Monthly Cap Utilization
              </h3>
              <p className="text-xs text-slate-500">
                Running total of hours logged vs. retainer caps for all client projects in the organization.
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="py-1.5 px-3 rounded-xl text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Project
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-3">Project & Client</th>
                  <th className="py-3 px-3">Assigned PM</th>
                  <th className="py-3 px-3">Monthly Cap</th>
                  <th className="py-3 px-3">Logged (This Month)</th>
                  <th className="py-3 px-3 w-40">Cap Progress</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3">Assigned Team</th>
                  <th className="py-3 px-3 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((p) => {
                  const progressWidth = Math.min(100, p.cap_percentage);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-slate-900 block text-sm">{p.name}</span>
                        <span className="text-slate-500 text-xs">{p.client_name}</span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                          <Briefcase className="w-3 h-3 text-blue-600" />
                          {p.assigned_pm_name}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono font-semibold text-slate-800">
                        {p.monthly_hourly_cap} hrs
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-900">
                        {p.current_month_hours} hrs
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${
                                p.cap_status === "over_cap"
                                  ? "bg-red-500"
                                  : p.cap_status === "warning"
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              }`}
                              style={{ width: `${progressWidth}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-slate-600 font-semibold w-10 text-right">
                            {p.cap_percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {p.cap_status === "over_cap" ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">
                            Over Cap
                          </span>
                        ) : p.cap_status === "warning" ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Within 10%
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-slate-700">
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold">{p.assigned_members_count}</span>
                          <span className="text-slate-400 text-[10px]">
                            ({p.members.map((m) => m.full_name.split(" ")[0]).slice(0, 2).join(", ")}
                            {p.members.length > 2 ? "..." : ""})
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <button
                          onClick={() => openEditProjectModal(p)}
                          className="py-1 px-2.5 rounded-lg text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition inline-flex items-center gap-1"
                          title="Assign PM & Members"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 2: Staff Access, Approvals & Role Management */}
      {activeSubTab === "users" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                Staff Access & Role Management (RBAC)
              </h3>
              <p className="text-xs text-slate-500">
                Approve newly registered staff members, deactivate accounts, and grant PM or Admin permissions.
              </p>
            </div>
            <button
              onClick={() => setShowCreateUserModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 shadow-sm transition self-start sm:self-auto"
            >
              <UserPlus className="w-4 h-4" />
              Add User / PM
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-3">User Details</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Access Status</th>
                  <th className="py-3 px-3">Registered On</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 block">{u.full_name}</span>
                      <span className="text-slate-500">{u.email}</span>
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={u.role_name}
                        onChange={(e) => handleChangeUserRole(u, e.target.value)}
                        className="text-xs rounded-lg border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="admin">Admin</option>
                        <option value="pm">Project Manager</option>
                        <option value="member">Member / Dev</option>
                      </select>
                    </td>
                    <td className="py-3 px-3">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <Check className="w-3 h-3" /> Approved & Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                          Pending Approval
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleToggleUserStatus(u)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                          u.is_active
                            ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                            : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                        }`}
                      >
                        {u.is_active ? "Deactivate" : "Approve Access"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 3: Audit Trail */}
      {activeSubTab === "audit" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                System Audit Trail (Standard Architecture)
              </h3>
              <p className="text-xs text-slate-500">
                Immutable chronological log of authentication, project mutations, punch sessions, and RAG access.
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target Entity</th>
                  <th className="py-2.5 px-3">Details / Mutation</th>
                  <th className="py-2.5 px-3 text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition text-[11px]">
                    <td className="py-2.5 px-3 text-slate-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-800">
                      {log.user_email}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-600">
                      {log.entity_type} {log.entity_id ? `(#${log.entity_id})` : ""}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                      {log.new_values ? JSON.stringify(log.new_values) : "--"}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      {log.ip_address || "127.0.0.1"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Admin Add User / PM Modal */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Admin: Add New Staff User</h3>
              </div>
              <button
                onClick={() => setShowCreateUserModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdminCreateUser} className="space-y-4 py-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Connor"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Work Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="sarah@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Initial Password
                </label>
                <input
                  type="text"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Password123!"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs text-slate-900"
                />
                <p className="text-[10px] text-slate-400 mt-1">Default password provided. User can change later.</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  System Role (RBAC) *
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs text-slate-900 bg-white"
                >
                  <option value="pm">Project Manager (PM) - Project & Team Management</option>
                  <option value="member">Member / Dev - Punch In & Time Logging</option>
                  <option value="admin">System Administrator</option>
                </select>
                <p className="text-[10px] text-purple-700 bg-purple-50 p-2 rounded-lg mt-2">
                  Admin privilege allows creating PMs, Members, and Admins. Created accounts are pre-approved and active immediately.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-200"
                >
                  {loading ? "Creating..." : "Create Staff User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Admin: Create & Assign Project</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdminCreateProject} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Project Zeta (Supply Chain)"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Client Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Globex Global Logistics"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Monthly Hour Cap *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newMonthlyCap}
                    onChange={(e) => setNewMonthlyCap(Number(e.target.value))}
                    className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Monthly Budget ($)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="12000"
                    value={newBudget}
                    onChange={(e) => setNewBudget(e.target.value ? Number(e.target.value) : "")}
                    className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Assign PM Selector */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Assign Project Manager (PM) *
                </label>
                <select
                  value={newAssignedPmId}
                  onChange={(e) => setNewAssignedPmId(Number(e.target.value))}
                  className="w-full text-sm rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                  required
                >
                  {availablePMs.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.full_name} ({pm.role_name.toUpperCase()} - {pm.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Assign Team Members Checklist */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 uppercase tracking-wide">
                    Assign Team Members ({newSelectedMemberIds.length} selected)
                  </label>
                  <span className="text-[10px] text-slate-400">Developers & Staff</span>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                  {availableMembers.length === 0 ? (
                    <p className="text-slate-400 italic text-center py-2">No active members found.</p>
                  ) : (
                    availableMembers.map((m) => {
                      const isChecked = newSelectedMemberIds.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition ${
                            isChecked
                              ? "bg-purple-50 border-purple-300 text-purple-900"
                              : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewSelectedMemberIds([...newSelectedMemberIds, m.id]);
                                } else {
                                  setNewSelectedMemberIds(
                                    newSelectedMemberIds.filter((id) => id !== m.id)
                                  );
                                }
                              }}
                              className="rounded text-purple-600 focus:ring-purple-500"
                            />
                            <div>
                              <span className="font-semibold block">{m.full_name}</span>
                              <span className="text-[10px] text-slate-400">{m.email}</span>
                            </div>
                          </div>
                          {isChecked && <span className="text-purple-600 font-bold text-xs">✓</span>}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-200"
                >
                  Create & Assign Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Manage PM & Team Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Reassign PM & Team Members</h3>
                <p className="text-xs text-slate-500">Project: {editingProject.name}</p>
              </div>
              <button
                onClick={() => setEditingProject(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 my-4 text-xs">
              {/* Change PM */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Assigned Project Manager (PM)
                </label>
                <select
                  value={editPmId}
                  onChange={(e) => setEditPmId(Number(e.target.value))}
                  className="w-full text-sm rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                >
                  {availablePMs.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.full_name} ({pm.role_name.toUpperCase()} - {pm.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Team Members */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 uppercase tracking-wide">
                    Allocated Team Members ({editMemberIds.length} assigned)
                  </label>
                  <span className="text-[10px] text-slate-400">Check to add / uncheck to remove</span>
                </div>

                <div className="max-h-52 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                  {availableMembers.map((m) => {
                    const isChecked = editMemberIds.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition ${
                          isChecked
                            ? "bg-purple-50 border-purple-300 text-purple-900"
                            : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditMemberIds([...editMemberIds, m.id]);
                              } else {
                                setEditMemberIds(editMemberIds.filter((id) => id !== m.id));
                              }
                            }}
                            className="rounded text-purple-600 focus:ring-purple-500"
                          />
                          <div>
                            <span className="font-semibold block">{m.full_name}</span>
                            <span className="text-[10px] text-slate-400">{m.email}</span>
                          </div>
                        </div>
                        {isChecked && <span className="text-purple-600 font-bold text-xs">✓</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProjectEdits}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-200"
              >
                Save Allocations
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
