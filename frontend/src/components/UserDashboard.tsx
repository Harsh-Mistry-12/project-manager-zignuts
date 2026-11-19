"use client";

import React, { useState, useEffect } from "react";
import { Project, TimeEntry, apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Briefcase,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  FolderGit2,
  Users,
  ArrowRight,
  ShieldAlert,
  Play,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";

interface UserDashboardProps {
  onNavigateTab: (tab: string) => void;
}

export default function UserDashboard({ onNavigateTab }: UserDashboardProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projList, entries] = await Promise.all([
        apiFetch<Project[]>("/projects"),
        apiFetch<TimeEntry[]>("/time-entries"),
      ]);
      setProjects(projList);
      setRecentEntries(entries.slice(0, 5));
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Compute aggregated summary stats
  const totalCap = projects.reduce((sum, p) => sum + (p.monthly_hourly_cap || 0), 0);
  const totalLogged = projects.reduce((sum, p) => sum + (p.current_month_hours || 0), 0);
  const totalRemaining = Math.max(0, totalCap - totalLogged);
  const warningProjects = projects.filter((p) => p.cap_status === "warning");
  const overCapProjects = projects.filter((p) => p.cap_status === "over_cap");
  const hasAlerts = warningProjects.length > 0 || overCapProjects.length > 0;

  // Current month string
  const currentMonthName = new Date().toLocaleString("default", { month: "long", year: "numeric" });

  const renderCapStatusBadge = (status: "normal" | "warning" | "over_cap", pct: number) => {
    switch (status) {
      case "over_cap":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            <ShieldAlert className="w-3.5 h-3.5 text-red-600 animate-pulse" />
            Over Cap ({pct}%)
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Near Cap ({pct}%)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Healthy ({pct}%)
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-[360px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading your projects and utilization metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">
                Welcome back, {user?.full_name}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Team Member
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Monthly retainer caps, remaining hours, and project allocations for <strong>{currentMonthName}</strong>.
            </p>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => onNavigateTab("punch")}
              className="py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm flex items-center gap-1.5"
            >
              <Clock className="w-4 h-4" />
              <span>Punch Clock</span>
            </button>
            <button
              onClick={() => onNavigateTab("manual-log")}
              className="py-2.5 px-4 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition shadow-sm flex items-center gap-1.5"
            >
              <Calendar className="w-4 h-4" />
              <span>Time Logs</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Prominent Cap Warning Banner (shown whenever any project is in Warning or Over Cap) */}
      {hasAlerts && (
        <div className="space-y-3">
          {overCapProjects.map((p) => {
            const overHours = Math.max(0, p.current_month_hours - p.monthly_hourly_cap).toFixed(1);
            return (
              <div
                key={`alert-over-${p.id}`}
                className="p-4 rounded-2xl bg-red-50 border-2 border-red-300 text-red-900 shadow-sm flex items-start gap-3 animate-in fade-in"
              >
                <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5 animate-pulse" />
                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-red-900">
                      🚨 Over Cap Alert: {p.name}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-200 text-red-900">
                      {p.cap_percentage}% Used
                    </span>
                  </div>
                  <p className="mt-1 text-red-800">
                    This project has exceeded its monthly limit of <strong>{p.monthly_hourly_cap} hrs</strong> by{" "}
                    <strong>{overHours} hrs</strong> (current total: <strong>{p.current_month_hours} hrs</strong>).
                    Please coordinate with PM <strong>{p.assigned_pm_name}</strong> before logging additional hours.
                  </p>
                </div>
              </div>
            );
          })}

          {warningProjects.map((p) => {
            const remaining = Math.max(0, p.monthly_hourly_cap - p.current_month_hours).toFixed(1);
            return (
              <div
                key={`alert-warn-${p.id}`}
                className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 shadow-sm flex items-start gap-3 animate-in fade-in"
              >
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-amber-900">
                      ⚠️ Cap Warning: {p.name}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-200 text-amber-900">
                      {p.cap_percentage}% Used
                    </span>
                  </div>
                  <p className="mt-1 text-amber-800">
                    This project has consumed <strong>{p.current_month_hours} hrs</strong> of its{" "}
                    <strong>{p.monthly_hourly_cap} hrs</strong> cap ({p.cap_percentage}%). Only{" "}
                    <strong>{remaining} hrs remaining</strong> for {currentMonthName}.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Assigned Projects */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Assigned Projects
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">{projects.length}</span>
            <span className="text-xs text-slate-500 block mt-1">Active client retainers</span>
          </div>
        </div>

        {/* Total Monthly Cap */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Combined Cap
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900">{totalCap.toFixed(1)}h</span>
            <span className="text-xs text-slate-500 block mt-1">Allocated for {currentMonthName}</span>
          </div>
        </div>

        {/* Total Logged Hours */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Logged This Month
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-indigo-900">{totalLogged.toFixed(1)}h</span>
            <span className="text-xs text-slate-500 block mt-1">Total project hours logged</span>
          </div>
        </div>

        {/* Hours Left */}
        <div
          className={`rounded-2xl border p-5 shadow-sm ${
            overCapProjects.length > 0
              ? "bg-red-50/60 border-red-200"
              : warningProjects.length > 0
              ? "bg-amber-50/60 border-amber-200"
              : "bg-emerald-50/60 border-emerald-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Hours Left
            </span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                overCapProjects.length > 0
                  ? "bg-red-100 text-red-700"
                  : warningProjects.length > 0
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`text-2xl font-black ${
                overCapProjects.length > 0
                  ? "text-red-900"
                  : warningProjects.length > 0
                  ? "text-amber-900"
                  : "text-emerald-900"
              }`}
            >
              {totalRemaining.toFixed(1)}h
            </span>
            <span className="text-xs text-slate-600 block mt-1">
              {overCapProjects.length > 0
                ? `${overCapProjects.length} project(s) over cap!`
                : warningProjects.length > 0
                ? `${warningProjects.length} project(s) in warning`
                : "All assigned projects healthy"}
            </span>
          </div>
        </div>
      </div>

      {/* Assigned Projects Detail Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-indigo-600" />
            My Assigned Projects ({projects.length})
          </h3>
          <span className="text-xs text-slate-500">
            Real-time retainer caps & remaining hours breakdown
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <Briefcase className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="font-bold text-slate-800 text-sm">No Projects Assigned Yet</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You are currently not assigned to any client retainer projects. Please reach out to your Project Manager or Admin to be added to a project team.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {projects.map((p) => {
              const cap = p.monthly_hourly_cap || 160.0;
              const logged = p.current_month_hours || 0.0;
              const remaining = Number((cap - logged).toFixed(1));
              const progressWidth = Math.min(100, Math.max(0, p.cap_percentage));
              const isOverCap = p.cap_status === "over_cap";
              const isWarning = p.cap_status === "warning";

              return (
                <div
                  key={p.id}
                  className={`bg-white rounded-2xl border transition shadow-sm p-6 flex flex-col justify-between ${
                    isOverCap
                      ? "border-red-300 ring-1 ring-red-200 hover:border-red-400"
                      : isWarning
                      ? "border-amber-300 ring-1 ring-amber-200 hover:border-amber-400"
                      : "border-slate-200 hover:border-slate-300 hover:shadow-md"
                  }`}
                >
                  <div>
                    {/* Project Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                          {p.name}
                        </h4>
                        <span className="text-xs text-slate-500 mt-0.5 block">
                          Client: <strong>{p.client_name}</strong> • Managed by:{" "}
                          <strong>{p.assigned_pm_name || "Unassigned"}</strong>
                        </span>
                      </div>
                      {renderCapStatusBadge(p.cap_status, p.cap_percentage)}
                    </div>

                    {/* Utilization Progress Bar */}
                    <div className="mt-5">
                      <div className="flex justify-between text-xs text-slate-600 mb-1.5 font-medium">
                        <span>Utilization: <strong>{p.cap_percentage}%</strong></span>
                        <span>
                          {logged}h of {cap}h Cap
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isOverCap
                              ? "bg-red-500"
                              : isWarning
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${progressWidth}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats Grid: Cap, Logged, Hours Left */}
                    <div className="grid grid-cols-3 gap-2 mt-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                          Monthly Cap
                        </span>
                        <span className="text-base font-extrabold text-slate-900 block mt-0.5">
                          {cap}h
                        </span>
                      </div>

                      <div className="border-x border-slate-200">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                          Logged
                        </span>
                        <span className="text-base font-extrabold text-indigo-700 block mt-0.5">
                          {logged}h
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                          Hours Left
                        </span>
                        <span
                          className={`text-base font-extrabold block mt-0.5 ${
                            isOverCap
                              ? "text-red-600"
                              : isWarning
                              ? "text-amber-600"
                              : "text-emerald-700"
                          }`}
                        >
                          {remaining > 0 ? `${remaining}h` : "0.0h"}
                        </span>
                      </div>
                    </div>

                    {/* Warning Callout Box */}
                    {isOverCap && (
                      <div className="mt-3.5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <span>
                          <strong>Exceeded Cap:</strong> {Math.abs(remaining).toFixed(1)} hrs over the limit. Coordinate with PM before logging time.
                        </span>
                      </div>
                    )}

                    {isWarning && (
                      <div className="mt-3.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span>
                          <strong>Approaching Cap:</strong> Only {remaining} hrs remaining ({p.cap_percentage}% utilized).
                        </span>
                      </div>
                    )}

                    {!isOverCap && !isWarning && (
                      <div className="mt-3.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>
                          <strong>Healthy:</strong> {remaining} hours available under monthly retainer cap.
                        </span>
                      </div>
                    )}

                    {/* Team Members Count */}
                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {p.assigned_members_count || p.members?.length || 0} Team Member(s)
                      </span>
                      <span>Assigned to this project</span>
                    </div>
                  </div>

                  {/* Quick Card Action */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => onNavigateTab("punch")}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Clock in to this project</span>
                    </button>
                    <button
                      onClick={() => onNavigateTab("manual-log")}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
                    >
                      <span>Log time</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

