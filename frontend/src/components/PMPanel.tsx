"use client";

import React, { useState, useEffect } from "react";
import { Project, User, ProjectMember, ProjectAnnualHeatmap, UserProjectMetrics, apiFetch } from "@/lib/api";
import {
  Briefcase,
  Plus,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  X,
  UserPlus,
  Check,
  ChevronRight,
  DollarSign,
  Clock,
  Flame,
  BarChart3,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";

export default function PMPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [heatmapData, setHeatmapData] = useState<ProjectAnnualHeatmap | null>(null);
  const [loadingHeatmap, setLoadingHeatmap] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<"projects" | "user-management">("projects");

  // Create Project Modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newMonthlyCap, setNewMonthlyCap] = useState(160);
  const [newBudget, setNewBudget] = useState<number | "">("");

  // Member Assignment Modal state
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);

  // Create Team Member Modal state (PM)
  const [showCreateMemberModal, setShowCreateMemberModal] = useState<boolean>(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberPassword, setNewMemberPassword] = useState("Password123!");
  const [newMemberProjectId, setNewMemberProjectId] = useState<number | "">("");

  // Member Utilization Metrics Modal state
  const [showMemberMetricsModal, setShowMemberMetricsModal] = useState<boolean>(false);
  const [selectedMemberMetrics, setSelectedMemberMetrics] = useState<UserProjectMetrics | null>(null);
  const [loadingMemberMetrics, setLoadingMemberMetrics] = useState<boolean>(false);
  const [memberMetricsYear, setMemberMetricsYear] = useState<number>(new Date().getFullYear());
  const [activeMemberObj, setActiveMemberObj] = useState<ProjectMember | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadProjects = async () => {
    try {
      const data = await apiFetch<Project[]>("/projects");
      setProjects(data);
      if (selectedProject) {
        const updated = data.find((p) => p.id === selectedProject.id);
        if (updated) setSelectedProject(updated);
      } else if (data.length > 0) {
        setSelectedProject(data[0]);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await apiFetch<User[]>("/users");
      setAllUsers(data);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadProjects();
    loadUsers();
  }, []);

  // When selectedProject changes, load its annual heatmap (Sec 3)
  useEffect(() => {
    if (selectedProject) {
      loadHeatmap(selectedProject.id);
    }
  }, [selectedProject?.id]);

  // Auto-dismiss success notification after 5 seconds
  useEffect(() => {
    if (message?.type === "success") {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadHeatmap = async (projectId: number) => {
    setLoadingHeatmap(true);
    try {
      const data = await apiFetch<ProjectAnnualHeatmap>(`/stats/annual-heatmap/${projectId}`);
      setHeatmapData(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingHeatmap(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const created = await apiFetch<Project>("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: newProjectName,
          client_name: newClientName,
          monthly_hourly_cap: Number(newMonthlyCap),
          budget: newBudget ? Number(newBudget) : undefined,
        }),
      });
      setMessage({ type: "success", text: `Project "${created.name}" created successfully!` });
      setShowCreateModal(false);
      setNewProjectName("");
      setNewClientName("");
      setNewMonthlyCap(160);
      setNewBudget("");
      await loadProjects();
      setSelectedProject(created);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to create project" });
    } finally {
      setLoading(false);
    }
  };

  const handlePMCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const created = await apiFetch<User>("/users", {
        method: "POST",
        body: JSON.stringify({
          full_name: newMemberName,
          email: newMemberEmail,
          password: newMemberPassword || undefined,
          role_name: "member",
          initial_project_id: newMemberProjectId ? Number(newMemberProjectId) : undefined,
        }),
      });
      setMessage({
        type: "success",
        text: `Team Member "${created.full_name}" created successfully and assigned!`,
      });
      setShowCreateMemberModal(false);
      setNewMemberName("");
      setNewMemberEmail("");
      setNewMemberPassword("Password123!");
      setNewMemberProjectId("");
      await loadUsers();
      await loadProjects();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to create team member" });
    } finally {
      setLoading(false);
    }
  };

  const openAssignModal = () => {
    if (!selectedProject) return;
    setSelectedMemberIds(selectedProject.members.map((m) => m.user_id));
    setShowAssignModal(true);
  };

  const handleSaveAssignments = async () => {
    if (!selectedProject) return;
    setLoading(true);
    setMessage(null);
    try {
      const updated = await apiFetch<Project>(`/projects/${selectedProject.id}/members`, {
        method: "POST",
        body: JSON.stringify({ user_ids: selectedMemberIds }),
      });
      setSelectedProject(updated);
      setMessage({ type: "success", text: "Team assignments updated successfully!" });
      setShowAssignModal(false);
      await loadProjects();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to update assignments" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenMemberMetrics = async (member: ProjectMember, year?: number) => {
    if (!selectedProject) return;
    const targetYear = year || memberMetricsYear;
    setActiveMemberObj(member);
    setShowMemberMetricsModal(true);
    setLoadingMemberMetrics(true);
    try {
      const data = await apiFetch<UserProjectMetrics>(
        `/stats/project/${selectedProject.id}/user/${member.user_id}?year=${targetYear}`
      );
      setSelectedMemberMetrics(data);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: "error", text: err.message || "Failed to load member metrics" });
    } finally {
      setLoadingMemberMetrics(false);
    }
  };

  const renderCapBadge = (status: "normal" | "warning" | "over_cap", pct: number) => {
    switch (status) {
      case "over_cap":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            <AlertTriangle className="w-3.5 h-3.5" /> Over Cap ({pct}%)
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" /> Warning: {pct}% Cap
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle className="w-3.5 h-3.5" /> Healthy ({pct}%)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-blue-600" />
              Project Manager Portal
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Manage client retainer caps, team allocations, and track annual utilization heatmaps.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="py-2 px-3.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </button>

            <button
              onClick={() => {
                if (selectedProject) {
                  setNewMemberProjectId(selectedProject.id);
                }
                setShowCreateMemberModal(true);
              }}
              className="py-2 px-3.5 rounded-xl text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 border border-blue-300 transition shadow-sm flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add Team Member</span>
            </button>
          </div>
        </div>

        {/* Sub Tabs navigation bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="bg-slate-100 p-1 rounded-xl flex overflow-x-auto text-xs font-semibold gap-1">
            <button
              onClick={() => setActiveSubTab("projects")}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition flex items-center gap-1.5 ${
                activeSubTab === "projects"
                  ? "bg-white text-blue-900 shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Projects & Heatmap ({projects.length})
            </button>
            <button
              onClick={() => setActiveSubTab("user-management")}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition flex items-center gap-1.5 ${
                activeSubTab === "user-management"
                  ? "bg-white text-blue-900 shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Sec 4: Team Allocation ({allUsers.filter((u) => u.role_name === "member").length})
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 border ${
              message.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {activeSubTab === "projects" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Section 1: PM Projects Listing */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                Sec 1: Managed Projects ({projects.length})
              </h3>
            </div>

            {projects.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                No projects assigned to you yet. Click "New Project" to create one.
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((p) => {
                  const isSelected = selectedProject?.id === p.id;
                  const progressWidth = Math.min(100, p.cap_percentage);
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProject(p)}
                      className={`cursor-pointer rounded-2xl border p-4 transition shadow-sm ${
                        isSelected
                          ? "bg-blue-50/50 border-blue-400 ring-2 ring-blue-100"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{p.name}</h4>
                          <span className="text-xs text-slate-500">{p.client_name}</span>
                        </div>
                        {renderCapBadge(p.cap_status, p.cap_percentage)}
                      </div>

                      {/* Progress Bar for Current Month */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-slate-600 mb-1">
                          <span>
                            Current Month: <strong>{p.current_month_hours}h</strong>
                          </span>
                          <span className="font-medium">Cap: {p.monthly_hourly_cap}h</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              p.cap_status === "over_cap"
                                ? "bg-red-500"
                                : p.cap_status === "warning"
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${progressWidth}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {p.assigned_members_count} members
                        </span>
                        <span className="text-blue-600 font-medium flex items-center gap-0.5">
                          View details <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2 & 3: Project Details & Annual Heatmap */}
          <div className="lg:col-span-2 space-y-6">
            {selectedProject ? (
              <>
                {/* Section 2: Details & Assigned Members */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                        Sec 2: Project Details
                      </span>
                      <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                        {selectedProject.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Client: {selectedProject.client_name} • Manager: {selectedProject.assigned_pm_name}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={openAssignModal}
                        className="py-1.5 px-3 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition flex items-center gap-1.5"
                      >
                        Manage Allocations
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Monthly Cap</span>
                      <span className="text-base font-bold text-slate-800">
                        {selectedProject.monthly_hourly_cap} hrs
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Logged This Month</span>
                      <span className="text-base font-bold text-slate-800">
                        {selectedProject.current_month_hours} hrs
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Cap Utilization</span>
                      <span className="text-base font-bold text-slate-800">
                        {selectedProject.cap_percentage}%
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-500 block">Monthly Retainer</span>
                      <span className="text-base font-bold text-slate-800">
                        ${selectedProject.budget || 0}
                      </span>
                    </div>
                  </div>

                  {/* Assigned Members List */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      Assigned Team Members ({selectedProject.members.length})
                    </h4>
                    {selectedProject.members.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                        No team members currently assigned. Click "Manage Team" to allocate developers.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedProject.members.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => handleOpenMemberMetrics(m)}
                            className="group cursor-pointer flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-xs transition shadow-sm"
                            title="Click to view month-wise logged hours & cap utilization"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-[10px] group-hover:bg-blue-600 transition">
                                {m.full_name.charAt(0)}
                              </div>
                              <div>
                                <span className="font-semibold text-slate-800 group-hover:text-blue-900 transition flex items-center gap-1">
                                  {m.full_name}
                                </span>
                                <span className="text-slate-400 text-[10px]">{m.email}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Active
                              </span>
                              <span className="text-[10px] text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition hidden sm:inline">
                                View &rarr;
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 3: Annual Heatmap View per Project */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
                        <Flame className="w-4 h-4 text-amber-500" />
                        Sec 3: Annual Heatmap Matrix (Year {heatmapData?.year || 2026})
                      </span>
                      <h4 className="text-sm font-extrabold text-slate-800 mt-0.5">
                        Monthly Cap vs Time Logged (12-Month Matrix)
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-1 text-slate-500">
                        <span className="w-2.5 h-2.5 rounded bg-emerald-400" /> &lt;90%
                      </span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <span className="w-2.5 h-2.5 rounded bg-amber-400" /> 90-100%
                      </span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <span className="w-2.5 h-2.5 rounded bg-red-400" /> &gt;100%
                      </span>
                    </div>
                  </div>

                  {loadingHeatmap ? (
                    <div className="py-8 text-center text-xs text-slate-400">Loading annual heatmap...</div>
                  ) : (
                    <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
                      {heatmapData?.months.map((m) => {
                        let bgStyle = "bg-slate-50 border-slate-200 text-slate-700";
                        if (m.logged_hours > 0) {
                          if (m.status === "over_cap") {
                            bgStyle = "bg-red-50 border-red-300 text-red-900";
                          } else if (m.status === "warning") {
                            bgStyle = "bg-amber-50 border-amber-300 text-amber-900";
                          } else {
                            bgStyle = "bg-emerald-50 border-emerald-300 text-emerald-900";
                          }
                        }

                        return (
                          <div
                            key={m.month}
                            className={`p-3 rounded-xl border transition-all text-xs flex flex-col justify-between ${bgStyle}`}
                          >
                            <span className="font-bold uppercase tracking-wider text-[11px] block">
                              {m.month_name.slice(0, 3)}
                            </span>
                            <div className="my-1.5">
                              <span className="text-base font-extrabold block">
                                {m.logged_hours}h
                              </span>
                              <span className="text-[10px] text-slate-500">
                                / {m.monthly_cap}h cap
                              </span>
                            </div>
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded w-max ${
                                m.status === "over_cap"
                                  ? "bg-red-200/70 text-red-800"
                                  : m.status === "warning"
                                  ? "bg-amber-200/70 text-amber-800"
                                  : m.logged_hours > 0
                                  ? "bg-emerald-200/70 text-emerald-800"
                                  : "bg-slate-200/50 text-slate-500"
                              }`}
                            >
                              {m.percentage}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                Select a project from the left panel to view details and heatmap.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Section 4: PM User Management (Allocate team members) */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block mb-1">
                Sec 4: PM User Management
              </span>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Organization Team Members Allocation
              </h3>
              <p className="text-xs text-slate-500">
                View all available developers and organization team members.
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Name & Email</th>
                  <th className="py-2.5 px-3">System Role</th>
                  <th className="py-2.5 px-3">Account Status</th>
                  <th className="py-2.5 px-3">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allUsers
                  .filter((u) => u.role_name === "member")
                  .map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-800 block">{u.full_name}</span>
                        <span className="text-slate-400">{u.email}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          {u.role_name}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {u.is_active ? (
                          <span className="text-emerald-600 font-medium flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Approved
                          </span>
                        ) : (
                          <span className="text-amber-600 font-medium">Pending Approval</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Create Retainer Project</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Project Epsilon (AI Analytics)"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Client Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corporation"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Monthly Budget ($)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="10000"
                    value={newBudget}
                    onChange={(e) => setNewBudget(e.target.value ? Number(e.target.value) : "")}
                    className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Assignment Modal */}
      {showAssignModal && selectedProject && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Assign Team Members</h3>
                <p className="text-xs text-slate-500">Project: {selectedProject.name}</p>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 max-h-60 overflow-y-auto space-y-2">
              {allUsers
                .filter((u) => u.role_name === "member" && u.is_active)
                .map((u) => {
                  const isChecked = selectedMemberIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer text-xs transition ${
                        isChecked
                          ? "bg-blue-50 border-blue-300 text-blue-900"
                          : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMemberIds([...selectedMemberIds, u.id]);
                            } else {
                              setSelectedMemberIds(selectedMemberIds.filter((id) => id !== u.id));
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="font-semibold block">{u.full_name}</span>
                          <span className="text-[10px] text-slate-400">{u.email}</span>
                        </div>
                      </div>
                      {isChecked && <span className="text-blue-600 font-bold text-xs">✓</span>}
                    </label>
                  );
                })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAssignModal(false);
                  setNewMemberProjectId(selectedProject.id);
                  setShowCreateMemberModal(true);
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" /> + New Member
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignments}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200"
                >
                  Save Assignments
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PM Add Team Member Modal */}
      {showCreateMemberModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">PM: Add Team Member</h3>
              </div>
              <button
                onClick={() => setShowCreateMemberModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePMCreateMember} className="space-y-4 py-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Rivera"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Work Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="alex.rivera@example.com"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Initial Password
                </label>
                <input
                  type="text"
                  value={newMemberPassword}
                  onChange={(e) => setNewMemberPassword(e.target.value)}
                  placeholder="Password123!"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs text-slate-900"
                />
                <p className="text-[10px] text-slate-400 mt-1">Default password provided. Member can change later.</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Assign to Project (Optional)
                </label>
                <select
                  value={newMemberProjectId}
                  onChange={(e) => setNewMemberProjectId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs text-slate-900 bg-white"
                >
                  <option value="">-- No initial project assignment --</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.client_name})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-blue-700 bg-blue-50 p-2 rounded-lg mt-2">
                  Role will be created as <strong>Member / Dev</strong> with active status. PMs are permitted to add team members to their managed projects.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateMemberModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200"
                >
                  {loading ? "Adding..." : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Member Month-Wise Utilization Modal */}
      {showMemberMetricsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 my-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
                  {activeMemberObj?.full_name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {activeMemberObj?.full_name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeMemberObj?.email} • Project:{" "}
                    <strong className="text-slate-700">{selectedProject?.name}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Year selector */}
                <select
                  value={memberMetricsYear}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    setMemberMetricsYear(y);
                    if (activeMemberObj) {
                      handleOpenMemberMetrics(activeMemberObj, y);
                    }
                  }}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                </select>
                <button
                  onClick={() => setShowMemberMetricsModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingMemberMetrics ? (
              <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                Loading month-wise logged hours & utilization...
              </div>
            ) : selectedMemberMetrics ? (
              <div className="space-y-5 pt-4">
                {/* Top 4 KPI Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      This Month
                    </span>
                    <span className="text-lg font-extrabold text-blue-700 block mt-0.5">
                      {selectedMemberMetrics.current_month_hours}h
                    </span>
                    <span className="text-[10px] text-slate-400">Hours logged</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      Cap Utilization
                    </span>
                    <span
                      className={`text-lg font-extrabold block mt-0.5 ${
                        selectedMemberMetrics.current_month_utilization > 100
                          ? "text-red-600"
                          : selectedMemberMetrics.current_month_utilization >= 90
                          ? "text-amber-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {selectedMemberMetrics.current_month_utilization}%
                    </span>
                    <span className="text-[10px] text-slate-400">Current month</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      Year Total
                    </span>
                    <span className="text-lg font-extrabold text-slate-900 block mt-0.5">
                      {selectedMemberMetrics.total_year_hours}h
                    </span>
                    <span className="text-[10px] text-slate-400">Total in {selectedMemberMetrics.months[0]?.year}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      Monthly Cap
                    </span>
                    <span className="text-lg font-extrabold text-slate-900 block mt-0.5">
                      {selectedMemberMetrics.monthly_hourly_cap}h
                    </span>
                    <span className="text-[10px] text-slate-400">Project limit</span>
                  </div>
                </div>

                {/* Month-Wise Breakdown */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      Month-wise Breakdown & Utilization ({selectedMemberMetrics.months[0]?.year})
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      Cap: {selectedMemberMetrics.monthly_hourly_cap} hrs/month
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px] sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3.5">Month</th>
                          <th className="py-2.5 px-3 text-right">Logged Hours</th>
                          <th className="py-2.5 px-3">Utilization</th>
                          <th className="py-2.5 px-3 text-right">Cap %</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedMemberMetrics.months.map((m) => {
                          const progressWidth = Math.min(100, Math.max(0, m.cap_utilization));
                          return (
                            <tr key={m.month} className="hover:bg-slate-50/70 transition">
                              <td className="py-2.5 px-3.5 font-medium text-slate-800">
                                {m.month_name}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                                {m.logged_hours > 0 ? `${m.logged_hours}h` : "--"}
                              </td>
                              <td className="py-2.5 px-3 w-36">
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      m.status === "over_cap"
                                        ? "bg-red-500"
                                        : m.status === "warning"
                                        ? "bg-amber-500"
                                        : "bg-emerald-500"
                                    }`}
                                    style={{ width: `${progressWidth}%` }}
                                  />
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                                {m.cap_utilization}%
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {m.logged_hours === 0 ? (
                                  <span className="text-[10px] text-slate-400">--</span>
                                ) : m.status === "over_cap" ? (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                                    Over Cap
                                  </span>
                                ) : m.status === "warning" ? (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    Warning
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Healthy
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer info notice */}
                <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100">
                  <span>Cap Utilization = (Logged Hours / Monthly Cap) × 100%</span>
                  <button
                    onClick={() => setShowMemberMetricsModal(false)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

