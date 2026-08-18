// Staff API client — config from src/lib/config.ts (no Vite env).
import { API_BASE as CONFIG_API_BASE, AGI_ENABLED as AGI_FLAG } from "./config";
import { dedupedRequest } from "./dedupe";

export const API_BASE = CONFIG_API_BASE;
export const DEMO_MODE = false;
export const AGI_ENABLED = AGI_FLAG;

/** Same-origin media URLs — rewrite absolute upstream API paths. */
export function mediaUrl(path?: string | null): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      if (u.pathname.startsWith("/api/")) return `${u.pathname}${u.search}`;
    } catch { /* keep */ }
    return path;
  }
  return path.startsWith("/") ? path : `/${path}`;
}

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

type RequestOpts = {
  body?: unknown;
  params?: Record<string, string | number | boolean>;
  form?: Record<string, string>;
  /** Per-request timeout in ms (e.g. 180_000 for AGI session start). */
  timeoutMs?: number;
};

async function request<T>(
  method: string,
  path: string,
  opts: RequestOpts = {},
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

  const controller = opts.timeoutMs != null ? new AbortController() : null;
  const timer = controller && opts.timeoutMs != null
    ? window.setTimeout(() => controller.abort(), opts.timeoutMs)
    : null;
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body, signal: controller?.signal });
  } catch (err) {
    if (timer != null) window.clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(408, "Request timed out");
    }
    throw err;
  }
  if (timer != null) window.clearTimeout(timer);
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
  get: <T>(path: string, opts?: RequestOpts) =>
    dedupedRequest("GET", path, opts?.body, () => request<T>("GET", path, opts)),
  post: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>("POST", path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>("PUT", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOpts) => request<T>("PATCH", path, { ...opts, body }),
  delete: <T>(path: string, opts?: RequestOpts) => request<T>("DELETE", path, opts),
  postForm: <T>(path: string, form: Record<string, string>) =>
    request<T>("POST", path, { form }),

  /** multipart/form-data (e.g. framework upload field `file`) */
  async postMultipart<T>(path: string, formData: FormData): Promise<T> {
    const headers: Record<string, string> = {};
    if (tokens.staff) headers["Authorization"] = `Bearer ${tokens.staff}`;
    headers["X-Device-Id"] = deviceId();
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
