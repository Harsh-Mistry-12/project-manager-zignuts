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
  Search,
  Filter,
  Check,
  X,
  RefreshCw,
} from "lucide-react";

export default function AdminPanel() {
  const [activeSubTab, setActiveSubTab] = useState<"projects" | "users" | "audit">("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [statsSummary, setStatsSummary] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
              Organization-wide oversight: Retainer budgets, project caps, staff approvals, and audit trail.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-semibold">
              <button
                onClick={() => setActiveSubTab("projects")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeSubTab === "projects"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Projects & Caps
              </button>
              <button
                onClick={() => setActiveSubTab("users")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeSubTab === "users"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Staff Access & Approvals
              </button>
              <button
                onClick={() => setActiveSubTab("audit")}
                className={`px-3 py-1.5 rounded-lg transition ${
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-3">Project & Client</th>
                  <th className="py-3 px-3">Project Manager</th>
                  <th className="py-3 px-3">Monthly Cap</th>
                  <th className="py-3 px-3">Logged (This Month)</th>
                  <th className="py-3 px-3 w-48">Cap Progress</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Team Size</th>
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
                      <td className="py-3.5 px-3 text-slate-700 font-medium">
                        {p.assigned_pm_name}
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
                      <td className="py-3.5 px-3 text-right text-slate-700 font-semibold">
                        {p.assigned_members_count} members
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
          <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Staff Access & Role Management (RBAC)
              </h3>
              <p className="text-xs text-slate-500">
                Approve newly registered staff members, deactivate accounts, and grant PM or Admin permissions.
              </p>
            </div>
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
    </div>
  );
}

