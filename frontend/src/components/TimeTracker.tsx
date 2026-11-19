"use client";

import React, { useState, useEffect } from "react";
import { Project, TimeEntry, apiFetch } from "@/lib/api";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  FileText,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export default function TimeTracker() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [projectId, setProjectId] = useState<number | "">("");
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [hours, setHours] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    try {
      const [projList, entries] = await Promise.all([
        apiFetch<Project[]>("/projects"),
        apiFetch<TimeEntry[]>("/time-entries"),
      ]);
      setProjects(projList);
      if (projList.length > 0 && projectId === "") {
        setProjectId(projList[0].id);
      }
      setTimeEntries(entries);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto-dismiss success notification after 5 seconds
  useEffect(() => {
    if (message?.type === "success") {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !hours || Number(hours) <= 0) {
      setMessage({ type: "error", text: "Please enter valid project and hours (>0)." });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch<TimeEntry>("/time-entries", {
        method: "POST",
        body: JSON.stringify({
          project_id: Number(projectId),
          date,
          hours: Number(hours),
          notes: notes.trim() || undefined,
        }),
      });
      setMessage({ type: "success", text: "Time entry logged successfully!" });
      setHours("");
      setNotes("");
      await loadData();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to log time" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (id: number) => {
    if (!confirm("Are you sure you want to delete this time entry?")) return;
    try {
      await apiFetch(`/time-entries/${id}`, { method: "DELETE" });
      setTimeEntries(timeEntries.filter((e) => e.id !== id));
      setMessage({ type: "success", text: "Time entry deleted." });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to delete" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-6 h-6 text-indigo-600" />
          Manual Time Tracking
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Record work hours, date, and task notes against your assigned client retainer projects.
        </p>

        {message && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 border ${
              message.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry Form */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 pb-3 border-b border-slate-100 mb-4">
            New Time Entry
          </h3>

          <form onSubmit={handleCreateEntry} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                Select Assigned Project *
              </label>
              {projects.length === 0 ? (
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
                  No assigned projects.
                </p>
              ) : (
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(Number(e.target.value))}
                  className="w-full text-sm rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.client_name})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Hours (e.g. 4.5) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  max="24"
                  required
                  placeholder="8.0"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                Work Notes
              </label>
              <textarea
                rows={3}
                placeholder="Implemented auth middleware, added docker test container"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || projects.length === 0}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Log Time Entry
            </button>
          </form>
        </div>

        {/* Entries List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Recent Time Entries ({timeEntries.length})
            </h3>
          </div>

          <div className="mt-4 overflow-x-auto">
            {timeEntries.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No time entries logged yet.
              </div>
            ) : (
              <table className="w-full min-w-[500px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Project</th>
                    <th className="py-2.5 px-3">Logged By</th>
                    <th className="py-2.5 px-3 text-right">Hours</th>
                    <th className="py-2.5 px-3">Notes</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {timeEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-3 font-mono text-slate-700">{e.date}</td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-900 block">{e.project_name}</span>
                        <span className="text-slate-400 text-[11px]">{e.client_name}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-700">{e.user_name}</td>
                      <td className="py-3 px-3 text-right font-extrabold text-slate-900 font-mono">
                        {e.hours}h
                      </td>
                      <td className="py-3 px-3 text-slate-500 max-w-xs truncate">
                        {e.notes || "--"}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleDeleteEntry(e.id)}
                          className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

