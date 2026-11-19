"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AIQueryResponse, apiFetch } from "@/lib/api";
import {
  Sparkles,
  Send,
  X,
  Bot,
  User as UserIcon,
  ShieldAlert,
  CheckCircle2,
  HelpCircle,
  CornerDownLeft,
} from "lucide-react";

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  isAllowed?: boolean;
  referencedProjects?: string[];
}

export default function AIAssistantModal({ isOpen, onClose }: AIAssistantModalProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        `Hello ${user?.full_name || ""}! I am your RBAC-aware Project & Time Tracking AI Assistant. ` +
        `You are logged in as a ${user?.role_name?.toUpperCase() || "MEMBER"}. ` +
        `I can answer questions regarding billable hours, monthly caps, assigned project managers, and team members for projects you are authorized to access.`,
      isAllowed: true,
    },
  ]);

  if (!isOpen) return null;

  const sampleQuestions = [
    "How many hours spent on Project Alpha in January 2026?",
    "Who is the project manager for Project Alpha?",
    "Who is the project manager for Project Delta?", // PM 1 should be denied this!
    "What is the monthly cap for Project Beta?",
    "Who is assigned to Project Alpha?",
  ];

  const handleSend = async (textToSend?: string) => {
    const prompt = (textToSend || query).trim();
    if (!prompt || loading) return;

    setQuery("");
    const newMsgList: Message[] = [...messages, { role: "user", content: prompt }];
    setMessages(newMsgList);
    setLoading(true);

    try {
      const res = await apiFetch<AIQueryResponse>("/ai/query", {
        method: "POST",
        body: JSON.stringify({ query: prompt }),
      });

      setMessages([
        ...newMsgList,
        {
          role: "assistant",
          content: res.answer,
          isAllowed: res.is_allowed,
          referencedProjects: res.referenced_projects,
        },
      ]);
    } catch (err: any) {
      setMessages([
        ...newMsgList,
        {
          role: "assistant",
          content: `Error: ${err.message || "Failed to contact AI service"}`,
          isAllowed: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl h-[85vh] sm:h-[650px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                RBAC-Aware AI Assistant
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                  RAG Engine
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Data scoped strictly to your {user?.role_name?.toUpperCase()} permissions
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold ${
                    m.isAllowed === false ? "bg-amber-600" : "bg-indigo-600"
                  }`}
                >
                  {m.isAllowed === false ? (
                    <ShieldAlert className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-slate-900 text-white"
                    : m.isAllowed === false
                    ? "bg-amber-50 border border-amber-200 text-amber-900 shadow-sm"
                    : "bg-slate-50 border border-slate-200 text-slate-800 shadow-sm"
                }`}
              >
                {/* Assistant status badge */}
                {m.role === "assistant" && m.isAllowed !== undefined && (
                  <div className="flex items-center gap-1.5 pb-1.5 mb-1.5 border-b border-black/5 text-[10px] font-bold">
                    {m.isAllowed ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Authorized Retrieval
                      </span>
                    ) : (
                      <span className="text-amber-700 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 text-amber-600" /> Access Denied by RBAC
                      </span>
                    )}
                  </div>
                )}

                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>

              {m.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-center">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                Retrieving authorized project records & evaluating RBAC...
              </div>
            </div>
          )}
        </div>

        {/* Suggested Queries Chips */}
        <div className="px-4 py-2 bg-slate-50/70 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px]">
          <span className="text-slate-400 font-semibold flex items-center gap-1 flex-shrink-0">
            <HelpCircle className="w-3 h-3" /> Try:
          </span>
          {sampleQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSend(q)}
              className="px-2.5 py-1 rounded-full bg-white hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-slate-600 transition whitespace-nowrap flex-shrink-0"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Field */}
        <div className="p-4 bg-white border-t border-slate-100">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything about your authorized projects, monthly caps, logged hours..."
              className="flex-1 text-xs sm:text-sm rounded-xl border border-slate-300 px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition shadow-md shadow-indigo-200 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

