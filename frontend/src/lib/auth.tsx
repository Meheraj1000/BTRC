"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearTokens, getToken, setTokens } from "./api";
import type { AuthUser, RoleCode } from "./types";

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: { email: string; password: string; fullName: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (...roles: RoleCode[]) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function homeFor(roles: RoleCode[]) {
  if (roles.includes("SUPER_ADMIN")) return "/admin/dashboard";
  if (roles.includes("GOVERNMENT")) return "/government/dashboard";
  if (roles.includes("POLICE")) return "/police/dashboard";
  if (roles.includes("BRTA")) return "/brta/dashboard";
  if (roles.includes("TRANSPORT_OWNER")) return "/owner/dashboard";
  if (roles.includes("DRIVER")) return "/driver/dashboard";
  return "/passenger/home";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api<AuthUser>("/auth/me")
      .then(setUser)
      .catch(() => {
        clearTokens();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    async login(email, password) {
      const data = await api<{ user: AuthUser; accessToken: string; refreshToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      return data.user;
    },
    async register(input) {
      await api("/auth/register", { method: "POST", body: JSON.stringify(input) });
    },
    async logout() {
      try {
        await api("/auth/logout", { method: "POST" });
      } catch {
        // still clear local session
      }
      clearTokens();
      setUser(null);
      router.push("/login");
    },
    async refresh() {
      const me = await api<AuthUser>("/auth/me");
      setUser(me);
    },
    hasRole: (...roles) => Boolean(user?.roles.some((r) => roles.includes(r))),
  }), [user, loading, router]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
