"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, apiFetch } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  quickLogin: (email: string) => Promise<void>;
  register: (fullName: string, email: string, password: string, roleName: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Failsafe timer: ensure loading never hangs indefinitely
    const failsafe = setTimeout(() => {
      setLoading(false);
    }, 3500);

    const savedToken = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (savedToken) {
      setToken(savedToken);
      apiFetch<User>("/auth/me", {}, savedToken)
        .then((userData) => {
          setUser(userData);
        })
        .catch(() => {
          if (typeof window !== "undefined") {
            localStorage.removeItem("auth_token");
          }
          setToken(null);
          setUser(null);
        })
        .finally(() => {
          clearTimeout(failsafe);
          setLoading(false);
        });
    } else {
      clearTimeout(failsafe);
      setLoading(false);
    }

    return () => clearTimeout(failsafe);
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await apiFetch<{ access_token: string; user: User }>("/auth/login/json", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("auth_token", res.access_token);
      setToken(res.access_token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (email: string) => {
    await login(email, "Password123!");
  };

  const register = async (fullName: string, email: string, password: string, roleName: string) => {
    setLoading(true);
    try {
      await apiFetch<User>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          role_name: roleName,
        }),
      });
      await login(email, password);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const updated = await apiFetch<User>("/auth/me", {}, token);
      setUser(updated);
    } catch {
      logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        quickLogin,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

