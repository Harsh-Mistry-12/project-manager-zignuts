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
  Menu,
  X,
  LayoutDashboard,
  Calendar,
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
  const [showMobileMenu, setShowMobileMenu] = useState(false);

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


  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-4 lg:gap-6">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-200 flex-shrink-0">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900">Zignuts</span>
                <span className="hidden sm:inline-block text-xs ml-1.5 font-medium px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                  Retainers & Time Tracker
                </span>
              </div>
            </div>

            {/* Desktop Nav Tabs */}
            <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-slate-200">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeTab === "dashboard"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                Dashboard
              </button>

              <button
                onClick={() => setActiveTab("punch")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
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
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
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
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Active punch banner pill */}
            {activePunchSession && (
              <button
                onClick={() => setActiveTab("punch")}
                className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 animate-pulse"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span className="truncate max-w-[140px]">Punched In: {activePunchSession.project_name}</span>
              </button>
            )}

            {/* AI Assistant button */}
            <button
              onClick={onOpenAI}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition shadow-sm"
              title="Open RBAC-aware RAG AI Assistant"
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
              <span className="hidden sm:inline">AI Assistant</span>
              <span className="sm:hidden font-semibold">AI</span>
            </button>



            {/* Desktop User Profile dropdown */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition"
              >
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs">
                  {user.full_name.charAt(0)}
                </div>
                <div className="hidden lg:block text-left text-xs">
                  <div className="font-semibold text-slate-800 truncate max-w-[110px]">{user.full_name}</div>
                  <div className="text-slate-500">{roleBadge()}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-sm font-bold text-slate-800">{user.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    <div className="mt-2">{roleBadge()}</div>
                  </div>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      logout();
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Hamburger Menu Toggle */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              aria-label="Toggle navigation menu"
            >
              {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {showMobileMenu && (
          <div className="md:hidden py-3 border-t border-slate-200 space-y-2 animate-in fade-in slide-in-from-top-1">
            <div className="px-2 py-1.5 flex items-center justify-between bg-slate-50 rounded-xl mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs">
                  {user.full_name.charAt(0)}
                </div>
                <div>
                  <span className="font-bold text-xs text-slate-900 block truncate max-w-[160px]">{user.full_name}</span>
                  <span className="text-[10px] text-slate-500">{user.email}</span>
                </div>
              </div>
              <div>{roleBadge()}</div>
            </div>

            {activePunchSession && (
              <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Punched In: {activePunchSession.project_name}
                </span>
                <button
                  onClick={() => {
                    setActiveTab("punch");
                    setShowMobileMenu(false);
                  }}
                  className="text-xs text-emerald-700 underline"
                >
                  View
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 gap-1 pt-1">
              <button
                onClick={() => {
                  setActiveTab("dashboard");
                  setShowMobileMenu(false);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold text-center transition flex flex-col items-center gap-1 ${
                  activeTab === "dashboard"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </button>

              <button
                onClick={() => {
                  setActiveTab("punch");
                  setShowMobileMenu(false);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold text-center transition flex flex-col items-center gap-1 ${
                  activeTab === "punch"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Clock className="w-4 h-4" />
                Punch In/Out
              </button>

              <button
                onClick={() => {
                  setActiveTab("manual-log");
                  setShowMobileMenu(false);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold text-center transition flex flex-col items-center gap-1 ${
                  activeTab === "manual-log"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Calendar className="w-4 h-4" />
                Time Logs
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  logout();
                }}
                className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 flex items-center justify-center gap-1.5 transition"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
