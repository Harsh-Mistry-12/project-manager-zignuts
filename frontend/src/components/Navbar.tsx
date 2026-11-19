"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Clock,
  ShieldCheck,
  UserCheck,
  Briefcase,
  LogOut,
  ChevronDown,
  Sparkles,
  Zap,
} from "lucide-react";

interface NavbarProps {
  onOpenAI: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activePunchSession?: any;
}

export default function Navbar({ onOpenAI, activeTab, setActiveTab, activePunchSession }: NavbarProps) {
  const { user, logout, quickLogin } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  if (!user) return null;

  const roleBadge = () => {
    switch (user.role_name) {
      case "admin":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <ShieldCheck className="w-3.5 h-3.5" /> Admin
          </span>
        );
      case "pm":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Briefcase className="w-3.5 h-3.5" /> Project Manager
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <UserCheck className="w-3.5 h-3.5" /> Team Member
          </span>
        );
    }
  };

  const demoAccounts = [
    { email: "admin@zignuts.com", label: "Admin: Sarah Connor", role: "admin" },
    { email: "pm1@zignuts.com", label: "PM: Alex Vance (Projects Alpha, Beta, Gamma)", role: "pm" },
    { email: "pm2@zignuts.com", label: "PM: Gordon Freeman (Project Delta)", role: "pm" },
    { email: "dev1@zignuts.com", label: "Dev: Harsh Patel (Alpha & Beta)", role: "member" },
    { email: "dev2@zignuts.com", label: "Dev: Elena Rostova (Alpha & Gamma)", role: "member" },
    { email: "dev3@zignuts.com", label: "Dev: Marcus Brody (Beta & Delta)", role: "member" },
    { email: "pending@zignuts.com", label: "New: Pending Approval", role: "pending" },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-200">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-slate-900">Zignuts</span>
                <span className="text-xs ml-1.5 font-medium px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                  Retainers & Time Tracker
                </span>
              </div>
            </div>

            {/* Nav Tabs */}
            <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-slate-200">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  activeTab === "dashboard"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                Dashboard
              </button>

              <button
                onClick={() => setActiveTab("punch")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5 ${
                  activeTab === "punch"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Clock className="w-4 h-4" />
                Punch In / Out
                {activePunchSession && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>

              <button
                onClick={() => setActiveTab("manual-log")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  activeTab === "manual-log"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                Time Entries
              </button>
            </nav>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            {/* Active punch banner pill */}
            {activePunchSession && (
              <button
                onClick={() => setActiveTab("punch")}
                className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 animate-pulse"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                Punched In: {activePunchSession.project_name}
              </button>
            )}

            {/* AI Assistant button */}
            <button
              onClick={onOpenAI}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition shadow-sm"
              title="Open RBAC-aware RAG AI Assistant"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>AI Assistant</span>
            </button>

            {/* Quick Demo Role Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowDemoAccounts(!showDemoAccounts)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                title="Switch demo personas"
              >
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">Switch Role</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showDemoAccounts && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    Switch Test Persona
                  </div>
                  {demoAccounts.map((acct) => (
                    <button
                      key={acct.email}
                      onClick={() => {
                        setShowDemoAccounts(false);
                        quickLogin(acct.email);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between ${
                        user.email === acct.email ? "bg-indigo-50 font-semibold text-indigo-900" : "text-slate-700"
                      }`}
                    >
                      <span className="truncate">{acct.label}</span>
                      {user.email === acct.email && <span className="text-indigo-600 font-bold">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* User Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-semibold flex items-center justify-center text-xs">
                  {user.full_name.charAt(0)}
                </div>
                <div className="hidden lg:block text-left text-xs">
                  <div className="font-semibold text-slate-800 truncate max-w-[120px]">{user.full_name}</div>
                  <div className="text-slate-500">{roleBadge()}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-800">{user.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    <div className="mt-2">{roleBadge()}</div>
                  </div>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
