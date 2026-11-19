"use client";

import React, { useState, useEffect } from "react";
import { Project, PunchSession, DailyPunchSummary, apiFetch } from "@/lib/api";
import {
  Clock,
  Play,
  Square,
  Calendar,
  AlertCircle,
  CheckCircle2,
  FileText,
  Timer,
  Layers,
} from "lucide-react";

interface PunchClockProps {
  onSessionChange?: () => void;
}

export default function PunchClock({ onSessionChange }: PunchClockProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">("");
  const [notes, setNotes] = useState<string>("");
  const [activeSession, setActiveSession] = useState<PunchSession | null>(null);
  const [dailySummary, setDailySummary] = useState<DailyPunchSummary | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load assigned projects for dropdown
  const loadAssignedProjects = async () => {
    try {
      const data = await apiFetch<Project[]>("/projects");
      setProjects(data);
      if (data.length > 0 && selectedProjectId === "") {
        setSelectedProjectId(data[0].id);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // Load active session
  const loadActiveSession = async () => {
    try {
      const active = await apiFetch<PunchSession | null>("/punch-sessions/active");
      setActiveSession(active);
      if (active) {
        setSelectedProjectId(active.project_id);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // Load daily punch history
  const loadDailySummary = async (dateStr: string) => {
    try {
      const summary = await apiFetch<DailyPunchSummary>(
        `/punch-sessions/daily?target_date=${dateStr}`
      );
      setDailySummary(summary);
      if (summary.active_session) {
        setActiveSession(summary.active_session);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAssignedProjects();
    loadActiveSession();
    loadDailySummary(selectedDate);
  }, [selectedDate]);

  // Live timer tick when active session is ongoing
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (activeSession && activeSession.start_time) {
      const calculateElapsed = () => {
        // Backend stores start_time in UTC or ISO
        const start = new Date(activeSession.start_time).getTime();
        const now = new Date().getTime();
        const diffSeconds = Math.max(0, Math.floor((now - start) / 1000));
        setElapsedSeconds(diffSeconds);
      };
      calculateElapsed();
      interval = setInterval(calculateElapsed, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSession]);

  const formatElapsed = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePunchIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      setError("Please select an assigned project to punch in.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const newSession = await apiFetch<PunchSession>("/punch-sessions/punch-in", {
        method: "POST",
        body: JSON.stringify({
          project_id: Number(selectedProjectId),
          notes: notes.trim() || undefined,
        }),
      });
      setActiveSession(newSession);
      setNotes("");
      setSuccessMsg(`Punched in to "${newSession.project_name}" successfully.`);
      await loadDailySummary(selectedDate);
      if (onSessionChange) onSessionChange();
    } catch (err: any) {
      setError(err.message || "Failed to punch in");
    } finally {
      setLoading(false);
    }
  };

  const handlePunchOut = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const closed = await apiFetch<PunchSession>("/punch-sessions/punch-out", {
        method: "POST",
        body: JSON.stringify({
          notes: notes.trim() || undefined,
        }),
      });
      setActiveSession(null);
      setNotes("");
      setSuccessMsg(
        `Punched out! Logged ${closed.duration_hours} hrs on "${closed.project_name}". Time entry recorded.`
      );
      await loadDailySummary(selectedDate);
      if (onSessionChange) onSessionChange();
    } catch (err: any) {
      setError(err.message || "Failed to punch out");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-6 h-6 text-indigo-600" />
              Live Punch Clock & Daily Log
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Select your assigned project to punch in. All punch sessions automatically generate billable retainer time entries upon punch out.
            </p>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-sm">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-600">Daily Log Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Main Punch Action Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Punch Control Box */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Attendance Status
              </span>
              {activeSession ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active Session
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  Idle / Not Punched In
                </span>
              )}
            </div>

            {/* Timer Display */}
            <div className="my-5 sm:my-6 text-center">
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight font-mono text-slate-900">
                {activeSession ? formatElapsed(elapsedSeconds) : "00:00:00"}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {activeSession ? (
                  <>Started at {new Date(activeSession.start_time).toLocaleTimeString()}</>
                ) : (
                  <>Ready to start your work session</>
                )}
              </p>
            </div>

            {/* Form Fields */}
            {!activeSession ? (
              <form onSubmit={handlePunchIn} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Select Assigned Project *
                  </label>
                  {projects.length === 0 ? (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      No assigned projects found. Please ask your PM to assign you to a project.
                    </p>
                  ) : (
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                      className="w-full text-sm rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.client_name}) - Cap: {p.monthly_hourly_cap}h
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Work Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Working on API endpoints and migrations"
                    className="w-full text-sm rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || projects.length === 0}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition shadow-md shadow-emerald-200 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Punch In
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Project:</span>
                    <span className="font-semibold text-slate-800">{activeSession.project_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Client:</span>
                    <span className="text-slate-700">{activeSession.client_name}</span>
                  </div>
                  {activeSession.notes && (
                    <div className="pt-1 text-slate-600 italic">
                      "{activeSession.notes}"
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Wrap-up Notes for Punch Out
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Completed ticket #102, updated unit tests"
                    className="w-full text-sm rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handlePunchOut}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition shadow-md shadow-red-200 flex items-center justify-center gap-2"
                >
                  <Square className="w-4 h-4 fill-current" />
                  Punch Out & Log Time
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400 text-center">
            Accurate punch timestamps backed by MySQL & audit logs.
          </div>
        </div>

        {/* Daily Summary & List of Punch Ins */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  Punch History for {selectedDate}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chronological breakdown of punch intervals and recorded billable hours.
                </p>
              </div>

              {/* Total Hours Pill */}
              <div className="bg-indigo-50 border border-indigo-200 px-3.5 py-1.5 rounded-xl text-right">
                <span className="text-xs text-indigo-600 font-medium block">Total Logged</span>
                <span className="text-lg font-extrabold text-indigo-900">
                  {dailySummary?.total_hours_logged || 0} hrs
                </span>
              </div>
            </div>

            {/* Table of Punch Ins */}
            <div className="mt-4 overflow-x-auto">
              {!dailySummary || dailySummary.sessions.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  <Timer className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No punch sessions logged for {selectedDate}.
                </div>
              ) : (
                <table className="w-full min-w-[540px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Project / Client</th>
                      <th className="py-2.5 px-3">Punch In</th>
                      <th className="py-2.5 px-3">Punch Out</th>
                      <th className="py-2.5 px-3 text-right">Duration</th>
                      <th className="py-2.5 px-3">Notes</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailySummary.sessions.map((sess) => (
                      <tr key={sess.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-800 block">
                            {sess.project_name}
                          </span>
                          <span className="text-slate-400 text-[11px]">{sess.client_name}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-mono">
                          {new Date(sess.start_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-mono">
                          {sess.end_time
                            ? new Date(sess.end_time).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "--"}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-800">
                          {sess.is_active ? (
                            <span className="text-emerald-600">Active</span>
                          ) : (
                            `${sess.duration_hours} hrs`
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500 max-w-[200px] truncate">
                          {sess.notes || "--"}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {sess.is_active ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              Ongoing
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                              Completed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
            <span>Synchronized with Retainer Time Tracking Database</span>
            <span>Date: {selectedDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

