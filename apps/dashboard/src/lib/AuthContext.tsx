"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch, setAccessToken } from "./api";
import { User } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCurrentUser = useCallback(async () => {
    try {
      const refreshed = await apiFetch<{ accessToken: string }>("/api/v1/auth/refresh", { method: "POST" });
      setAccessToken(refreshed.accessToken);
      const me = await apiFetch<{ user: User }>("/api/v1/auth/me");
      setUser(me.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiFetch<{ user: User; accessToken: string }>("/api/v1/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setAccessToken(result.accessToken);
    setUser(result.user);
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const result = await apiFetch<{ user: User; accessToken: string }>("/api/v1/auth/register", {
      method: "POST",
      body: { email, password, name },
    });
    setAccessToken(result.accessToken);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
