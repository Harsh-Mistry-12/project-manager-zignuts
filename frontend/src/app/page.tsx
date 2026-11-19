"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import AdminPanel from "@/components/AdminPanel";
import PMPanel from "@/components/PMPanel";
import PunchClock from "@/components/PunchClock";
import TimeTracker from "@/components/TimeTracker";
import AIAssistantModal from "@/components/AIAssistantModal";
import { PunchSession, apiFetch } from "@/lib/api";
import {
  Clock,
  ShieldCheck,
  Briefcase,
  UserCheck,
  Sparkles,
  Lock,
  Mail,
  User as UserIcon,
  Zap,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

export default function Home() {
  const { user, loading, login, register, quickLogin } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [showAIModal, setShowAIModal] = useState<boolean>(false);
  const [activePunchSession, setActivePunchSession] = useState<PunchSession | null>(null);

  // Auth form states
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("admin@zignuts.com");
  const [password, setPassword] = useState<string>("Password123!");
  const [fullName, setFullName] = useState<string>("");
  const [regRole, setRegRole] = useState<string>("member");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Check active punch session periodically or on change
  const refreshActivePunch = async () => {
    if (!user || !user.is_active) return;
    try {
      const active = await apiFetch<PunchSession | null>("/punch-sessions/active");
      setActivePunchSession(active);
    } catch {
      setActivePunchSession(null);
    }
  };

  useEffect(() => {
    if (user && user.is_active) {
      refreshActivePunch();
    }
  }, [user]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      if (isRegistering) {
        await register(fullName, email, password, regRole);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading session...</p>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Login / Register view
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-indigo-600 items-center justify-center text-white shadow-xl shadow-indigo-500/20 mb-3">
            <Clock className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Zignuts Project Management
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Retainer Tracking, Monthly Caps, Attendance & RBAC RAG AI Assistant
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
          <div className="bg-white/10 backdrop-blur-xl py-8 px-6 sm:px-10 rounded-3xl border border-white/10 shadow-2xl">
            {authError && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs">
              {isRegistering && (
                <>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Requested Role</label>
                    <select
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value)}
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-800 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="member">Team Member / Dev</option>
                      <option value="pm">Project Manager (PM)</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Work Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@zignuts.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 mt-2"
              >
                {authLoading ? (
                  "Processing..."
                ) : isRegistering ? (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setAuthError(null);
                  }}
                  className="text-xs text-indigo-300 hover:text-indigo-200 underline"
                >
                  {isRegistering
                    ? "Already have an account? Sign in"
                    : "Need a new account? Register here"}
                </button>
              </div>
            </form>

            {/* Quick 1-Click Test Personas */}
            <div className="mt-6 pt-5 border-t border-white/10">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 mb-2.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                1-Click Quick Demo Sign-In:
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <button
                  onClick={() => quickLogin("admin@zignuts.com")}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-left transition flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <div>
                    <span className="font-bold block text-white">Admin</span>
                    <span className="text-slate-400 text-[10px]">Sarah Connor</span>
                  </div>
                </button>

                <button
                  onClick={() => quickLogin("pm1@zignuts.com")}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-left transition flex items-center gap-2"
                >
                  <Briefcase className="w-4 h-4 text-blue-400" />
                  <div>
                    <span className="font-bold block text-white">PM 1</span>
                    <span className="text-slate-400 text-[10px]">Alex Vance</span>
                  </div>
                </button>

                <button
                  onClick={() => quickLogin("pm2@zignuts.com")}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-left transition flex items-center gap-2"
                >
                  <Briefcase className="w-4 h-4 text-blue-300" />
                  <div>
                    <span className="font-bold block text-white">PM 2</span>
                    <span className="text-slate-400 text-[10px]">Gordon Freeman</span>
                  </div>
                </button>

                <button
                  onClick={() => quickLogin("dev1@zignuts.com")}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-left transition flex items-center gap-2"
                >
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="font-bold block text-white">Employee</span>
                    <span className="text-slate-400 text-[10px]">Harsh Patel</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Account Pending Approval Notice
  if (!user.is_active) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Account Pending Admin Approval</h2>
          <p className="text-xs text-slate-500">
            Welcome, <strong>{user.full_name}</strong>! Your account has been created with role{" "}
            <span className="font-semibold text-slate-800">{user.role_name.toUpperCase()}</span>, but is awaiting approval from an administrator.
          </p>
          <div className="pt-2">
            <button
              onClick={() => quickLogin("admin@zignuts.com")}
              className="py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 transition"
            >
              Sign In as Admin to Approve
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation */}
      <Navbar
        onOpenAI={() => setShowAIModal(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activePunchSession={activePunchSession}
      />

      {/* Main App Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "dashboard" && (
          <>
            {user.role_name === "admin" && <AdminPanel />}
            {user.role_name === "pm" && <PMPanel />}
            {user.role_name === "member" && (
              <div className="space-y-6">
                <PunchClock onSessionChange={refreshActivePunch} />
                <TimeTracker />
              </div>
            )}
          </>
        )}

        {activeTab === "punch" && (
          <PunchClock onSessionChange={refreshActivePunch} />
        )}

        {activeTab === "manual-log" && <TimeTracker />}
      </main>

      {/* Floating AI Assistant Trigger Button in bottom corner */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setShowAIModal(true)}
          className="group flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/30 transition transform hover:-translate-y-0.5"
          title="Open RBAC-aware RAG AI Assistant"
        >
          <Sparkles className="w-5 h-5 text-indigo-200 group-hover:rotate-12 transition-transform" />
          <span className="text-xs font-bold tracking-wide">AI Assistant</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/20 font-semibold uppercase">
            RAG
          </span>
        </button>
      </div>

      {/* AI Assistant Modal */}
      <AIAssistantModal isOpen={showAIModal} onClose={() => setShowAIModal(false)} />
    </div>
  );
}
