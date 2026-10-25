import type { ApiOk } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const OFFLINE = "The office computer that runs this service is offline. Leave that computer on, then try again.";

async function readJson(res: Response) {
  const text = await res.text();
  if (!text.trim()) throw new Error(OFFLINE);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(OFFLINE);
  }
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("nt_access");
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem("nt_access", access);
  localStorage.setItem("nt_refresh", refresh);
}

export function clearTokens() {
  localStorage.removeItem("nt_access");
  localStorage.removeItem("nt_refresh");
}

async function tryRefresh() {
  const refresh = typeof window === "undefined" ? null : localStorage.getItem("nt_refresh");
  if (!refresh) return false;
  const res = await fetch(`${API}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  const json = (await readJson(res)) as ApiOk<{ accessToken: string; refreshToken: string }>;
  if (!res.ok || !json.success || !json.data?.accessToken) {
    clearTokens();
    return false;
  }
  setTokens(json.data.accessToken, json.data.refreshToken);
  return true;
}

export async function api<T>(path: string, init: RequestInit = {}, allowRefresh = true): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401 && allowRefresh && path !== "/auth/login" && path !== "/auth/refresh" && path !== "/auth/register") {
    const okRefresh = await tryRefresh();
    if (okRefresh) return api<T>(path, init, false);
  }
  const json = (await readJson(res)) as ApiOk<T> | {
    success: false;
    message: string;
    data?: { fieldErrors?: Record<string, string[] | undefined>; formErrors?: string[] } | null;
  };
  if (!res.ok || !("success" in json) || json.success === false) {
    const fail = json as { message?: string; data?: { fieldErrors?: Record<string, string[] | undefined> } | null };
    const fieldBits = fail.data?.fieldErrors
      ? Object.entries(fail.data.fieldErrors)
          .filter(([, errs]) => errs?.length)
          .map(([field, errs]) => `${field}: ${errs!.join(", ")}`)
      : [];
    const message = [fail.message, ...fieldBits].filter(Boolean).join(" — ") || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return json.data;
}

export function reportUrl(kind: string, format: "csv" | "xlsx" | "pdf") {
  const token = getToken();
  return `${API}/reports/${kind}?format=${format}&access_token=${token ?? ""}`;
}

export async function downloadReport(kind: string, format: "csv" | "xlsx" | "pdf") {
  const token = getToken();
  const res = await fetch(`${API}/reports/${kind}?format=${format}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Report download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nirapad-${kind}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
