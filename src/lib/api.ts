// Normalize: tolerate "staging.phantix.site/api/v1" (missing protocol) so the
// fetch never resolves against the page origin. Also guarantee the `/api/v1`
// prefix so no endpoint is ever called without it. Relative "/api/v1" is kept
// for same-origin dev proxies.
const RAW_API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
export const API_BASE = (() => {
  if (!RAW_API_BASE) return RAW_API_BASE;
  let base = RAW_API_BASE.replace(/\/+$/, "").replace(/^(?!https?:\/\/|\/)/i, "https://");
  if (base.startsWith("/")) return base; // relative — dev proxy already targets /api/v1
  if (!/\/api\/v1(?:\/|$)/i.test(base)) base = `${base}/api/v1`;
  return base;
})();

export const DEMO_MODE = !API_BASE;
import { dedupedRequest } from "./dedupe";

/** Build-time master switch — mirrors backend PHANTIX_AGI_ENABLED (default on). */
export const AGI_ENABLED = (import.meta.env.VITE_AGI_ENABLED ?? "true") !== "false";

// ── Token stores ────────────────────────────────────────────────────────────
export const tokens = {
  get staff() { return sessionStorage.getItem("staff_access_token"); },
  set staff(v: string | null) { v ? sessionStorage.setItem("staff_access_token", v) : sessionStorage.removeItem("staff_access_token"); },
  get email() { return sessionStorage.getItem("staff_email"); },
  set email(v: string | null) { v ? sessionStorage.setItem("staff_email", v) : sessionStorage.removeItem("staff_email"); },
};

export function deviceId(): string {
  let id = localStorage.getItem("phantix_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("phantix_device_id", id);
  }
  return id;
}

export function emailFromToken(): string {
  try {
    const t = tokens.staff;
    if (!t) return "";
    const payload = t.split(".")[1];
    if (!payload) return "";
    const decoded = JSON.parse(atob(payload));
    return typeof decoded.sub === "string" ? decoded.sub : typeof decoded.email === "string" ? decoded.email : "";
  } catch {
    return "";
  }
}

export function roleFromToken(): string {
  try {
    const t = tokens.staff;
    if (!t) return "";
    const payload = t.split(".")[1];
    if (!payload) return "";
    const decoded = JSON.parse(atob(payload));
    return typeof decoded.role === "string" ? decoded.role : "";
  } catch {
    return "";
  }
}

function detailMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: { msg?: string }) => d?.msg ?? "validation error").join(", ");
  }
  if (detail && typeof detail === "object") {
    const d = detail as Record<string, unknown>;
    if (typeof d.message === "string") return d.message;
    if (typeof d.detail === "string") return d.detail;
    if (typeof d.error === "string") return d.error;
  }
  return "Request failed";
}

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown) {
    super(detailMessage(detail));
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(
  method: string,
  path: string,
  opts: { body?: unknown; params?: Record<string, string | number | boolean>; form?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = {};

  if (tokens.staff) {
    headers["Authorization"] = `Bearer ${tokens.staff}`;
  }

  let url = `${API_BASE}${path}`;
  if (opts.params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(opts.params)) {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  let body: BodyInit | undefined;
  if (opts.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(opts.form).toString();
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, { method, headers, body });
  if (!res.ok) {
    let detail: unknown = res.statusText;
    try {
      detail = (await res.json()).detail;
    } catch { /* non-JSON */ }
    if (res.status === 401) {
      tokens.staff = null;
      tokens.email = null;
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, opts?: Parameters<typeof request>[2]) =>
    dedupedRequest("GET", path, opts?.body, () => request<T>("GET", path, opts)),
  post: <T>(path: string, body?: unknown, opts?: Parameters<typeof request>[2]) => request<T>("POST", path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: Parameters<typeof request>[2]) => request<T>("PUT", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: Parameters<typeof request>[2]) => request<T>("PATCH", path, { ...opts, body }),
  delete: <T>(path: string, opts?: Parameters<typeof request>[2]) => request<T>("DELETE", path, opts),
  postForm: <T>(path: string, form: Record<string, string>) =>
    request<T>("POST", path, { form }),

  /** multipart/form-data (e.g. framework upload field `file`) */
  async postMultipart<T>(path: string, formData: FormData): Promise<T> {
    const headers: Record<string, string> = {};
    if (tokens.staff) headers["Authorization"] = `Bearer ${tokens.staff}`;
    const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: formData });
    if (!res.ok) {
      let detail: unknown = res.statusText;
      try { detail = (await res.json()).detail; } catch { /* non-JSON */ }
      if (res.status === 401) { tokens.staff = null; tokens.email = null; }
      throw new ApiError(res.status, detail);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  },

  async download(path: string): Promise<Blob> {
    const headers: Record<string, string> = {};
    if (tokens.staff) headers["Authorization"] = `Bearer ${tokens.staff}`;
    const res = await fetch(`${API_BASE}${path}`, { method: "GET", headers });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    return res.blob();
  },

  async fetchText(path: string): Promise<string> {
    const headers: Record<string, string> = {};
    if (tokens.staff) headers["Authorization"] = `Bearer ${tokens.staff}`;
    const res = await fetch(`${API_BASE}${path}`, { method: "GET", headers });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    return res.text();
  },
};

export const delay = (ms = 420) => new Promise((r) => setTimeout(r, ms));
