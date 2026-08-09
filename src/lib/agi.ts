// PHANTIX AGI Management — staff portal data module.
// Mirrors app/engines/control_plane/api/admin/admin_agi.py (base /admin/agi).
// Demo-mode fallbacks so the portal is usable without a live runner.

import { api, ApiError, API_BASE, DEMO_MODE, delay } from "./api";
import type {
  AgiAction,
  AgiActivePolicy,
  AgiEngagement,
  AgiFinding,
  AgiPolicy,
  AgiSession,
  AgiSkill,
  AgiStatus,
  AgiToolInstallRequest,
  AgiTranscriptChunk,
} from "./types";

// ── Demo fixtures ─────────────────────────────────────────────────────────────
const demoTx: AgiTranscriptChunk[] = [];
let demoSeq = 0;

const demoStatus: AgiStatus = {
  enabled: true,
  runner_url: "http://127.0.0.1:8095",
  runner_reachable: true,
  runner_detail: "PHANTIX AGI runner is healthy",
  deepseek_only: true,
  default_image: "phantix-agi-sandbox:latest",
};

const demoPolicies: AgiPolicy[] = [
  { id: 1, version: "1.0.0", title: "Autonomous Pentest Agent Usage Agreement", is_active: true, published_at: new Date().toISOString(), created_at: new Date().toISOString() },
];

const demoActivePolicy: AgiActivePolicy = {
  id: 1,
  version: "1.0.0",
  title: "Autonomous Pentest Agent Usage Agreement",
  body_md: "# Autonomous Pentest Agent — Usage Agreement\n\nRead-only steps stream live. State-changing steps wait for your approval. Sessions destroy their containers when stopped. No host/server info, no other orgs, no direct DB access.",
  security_policy: { principles: ["scope-limited", "approval-gated", "container-isolated"] },
  is_active: true,
  published_at: new Date().toISOString(),
};

const demoEngagements: AgiEngagement[] = [
  {
    id: 11,
    organization_id: 42,
    created_by_staff_id: 1,
    name: "Acme Q3 external web",
    description: "ROE agreed 2026-08-01",
    scope_definition: {
      target_allowlist: ["203.0.113.10", "app.acme-lab.example", "https://app.acme-lab.example"],
      forbidden_actions: ["dos", "ransomware", "data_exfil_bulk"],
      rules_of_engagement: "Business hours only. Stop on PII.",
      max_session_minutes: 180,
    },
    status: "ready",
    config: { prompts: {}, tools: ["httpx", "nmap_safe", "nuclei_safe"], skills: { auto_select: true, auto_select_limit: 6 } },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    torn_down_at: null,
  },
  {
    id: 12,
    organization_id: 11,
    created_by_staff_id: 1,
    name: "Finlab internal network",
    description: "Internal posture verification",
    scope_definition: {
      target_allowlist: ["10.20.0.0/24", "staging.finlab.example"],
      forbidden_actions: ["dos"],
      rules_of_engagement: "Lab network only.",
      max_session_minutes: 60,
    },
    status: "draft",
    config: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    torn_down_at: null,
  },
];

const demoSessions: AgiSession[] = [
  {
    id: 101,
    engagement_id: 11,
    started_by_staff_id: 1,
    container_id: "agi-ctr-101",
    runner_session_id: "rs-101",
    status: "running",
    started_at: new Date(Date.now() - 600000).toISOString(),
    ended_at: null,
    teardown_reason: null,
    meta: { report: { report_id: 99, source: "phantix_agi" } },
  },
];

const demoActions: AgiAction[] = [
  {
    id: 501,
    session_id: 101,
    action_type: "state_changing",
    tool_name: "http_probe",
    proposed_command: "POST https://app.acme-lab.example/login -d 'username=admin&password=test'",
    rationale: "Verify default credentials on the in-scope login endpoint (lab only).",
    status: "pending_approval",
    approved_by_staff_id: null,
    decision_notes: null,
    result_summary: null,
    created_at: new Date().toISOString(),
    decided_at: null,
    executed_at: null,
  },
  {
    id: 502,
    session_id: 101,
    action_type: "tool_install",
    tool_name: "sqlmap",
    proposed_command: "apt-get install -y sqlmap",
    rationale: "Tool missing in container; installs only in this engagement container.",
    status: "pending_approval",
    approved_by_staff_id: null,
    decision_notes: null,
    result_summary: null,
    created_at: new Date().toISOString(),
    decided_at: null,
    executed_at: null,
  },
];

const demoToolInstalls: AgiToolInstallRequest[] = [
  { id: 1, session_id: 101, engagement_id: 11, organization_id: 42, tool_name: "sqlmap", package_hint: "sqlmap", install_command: "apt-get install -y sqlmap", rationale: "Missing from sandbox image", skill_id: "agi.learned.sqlmap", status: "pending_admin", result_summary: null, created_at: new Date().toISOString(), decided_at: null },
  { id: 2, session_id: 101, engagement_id: 11, organization_id: 42, tool_name: "feroxbuster", package_hint: "feroxbuster", install_command: "apt-get install -y feroxbuster", rationale: "Directory brute-force tool", skill_id: "agi.learned.feroxbuster", status: "pending_admin", result_summary: null, created_at: new Date(Date.now() - 3600000).toISOString(), decided_at: null },
];

const demoSills: AgiSkill[] = [
  { id: 1, skill_id: "agi.web.http-fingerprint", version: "1.0.0", title: "HTTP fingerprinting", kind: "web", status: "active", document: { body_md: "GET / and record headers" }, skill_md: "# HTTP fingerprinting\n1. GET /", organization_id: null, parent_skill_id: null, source: "manual", score: 0.82, uses: 14, successes: 12, failures: 2, approvals: 3, rejections: 0, source_session_id: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 2, skill_id: "agi.learned.sqlmap", version: "0.1.0", title: "SQLi verification (learned)", kind: "exploit_verify", status: "candidate", document: { body_md: "Run sqlmap --batch" }, skill_md: "# SQLi verification", organization_id: 42, parent_skill_id: null, source: "auto_mint", score: 0.62, uses: 2, successes: 2, failures: 0, approvals: 1, rejections: 0, source_session_id: 101, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

const demoFindings: AgiFinding[] = [
  { id: 1, session_id: 101, finding_id: "f-001", title: "Default credentials accepted on login", severity: "high", evidence: "POST /login with admin:test returned HTTP 200", source: "runner", tool: "http_probe", target: "https://app.acme-lab.example/login", status: "unverified", notes: null, created_at: new Date().toISOString(), risk_id: null },
  { id: 2, session_id: 101, finding_id: "f-002", title: "TLS version mismatch", severity: "medium", evidence: "TLSv1.0 negotiated", source: "runner", tool: "nmap_safe", target: "203.0.113.10", status: "unverified", notes: null, created_at: new Date().toISOString(), risk_id: null },
];

const demoGrants = [
  { id: 1, email: "engineer@phantix.ng", full_name: "Chidi Eze", role: "admin", agi_admin: true, is_active: true },
  { id: 2, email: "ada@phantix.ng", full_name: "Ada Okonkwo", role: "superadmin", agi_admin: true, is_active: true },
];

// ── Status ────────────────────────────────────────────────────────────────────
export async function loadAgiStatus(): Promise<AgiStatus | null> {
  if (DEMO_MODE) { await delay(250); return demoStatus; }
  try {
    const res = await api.get<AgiStatus>("/admin/agi/status");
    return res ?? null;
  } catch { return null; }
}

// ── Policies ──────────────────────────────────────────────────────────────────
export async function loadAgiPolicies(): Promise<AgiPolicy[]> {
  if (DEMO_MODE) { await delay(200); return demoPolicies; }
  const res = await api.get<AgiPolicy[]>("/admin/agi/policies");
  return Array.isArray(res) ? res : [];
}

export async function loadAgiActivePolicy(): Promise<AgiActivePolicy | null> {
  if (DEMO_MODE) { await delay(200); return demoActivePolicy; }
  try {
    return await api.get<AgiActivePolicy>("/admin/agi/policies/active");
  } catch { return null; }
}

export async function publishAgiPolicy(payload: { version: string; title: string; body_md: string; security_policy?: Record<string, unknown>; activate?: boolean }): Promise<{ id: number; version: string; title: string; is_active: boolean; message: string }> {
  if (DEMO_MODE) {
    await delay(300);
    return { id: 2, version: payload.version, title: payload.title, is_active: true, message: "Customers must re-accept when a new active version is published" };
  }
  return api.post<{ id: number; version: string; title: string; is_active: boolean; message: string }>("/admin/agi/policies", payload);
}

// ── Grants ────────────────────────────────────────────────────────────────────
export async function loadAgiGrants(): Promise<any[]> {
  if (DEMO_MODE) { await delay(250); return demoGrants; }
  // List ALL staff (admin+ accessible) so a superadmin can grant/revoke agi_admin
  // on any admin user — the /admin/agi/grants list only returns those already flagged.
  const staff = await api.get<any[]>("/staff");
  return Array.isArray(staff) ? staff : [];
}

export async function setAgiGrant(staffId: number, agiAdmin: boolean): Promise<any> {
  if (DEMO_MODE) { await delay(250); return { id: staffId, agi_admin: agiAdmin }; }
  return api.post<any>("/admin/agi/grants", { staff_id: staffId, agi_admin: agiAdmin });
}

// ── Engagements ───────────────────────────────────────────────────────────────
export async function loadAgiEngagements(): Promise<AgiEngagement[]> {
  if (DEMO_MODE) { await delay(250); return demoEngagements; }
  const res = await api.get<AgiEngagement[]>("/admin/agi/engagements?limit=100");
  return Array.isArray(res) ? res : [];
}

export async function createAgiEngagement(payload: {
  organization_id: number;
  name: string;
  description?: string;
  scope: { target_allowlist: string[]; forbidden_actions: string[]; rules_of_engagement?: string; max_session_minutes?: number };
  config?: Record<string, unknown>;
}): Promise<AgiEngagement> {
  if (DEMO_MODE) {
    await delay(350);
    const eng: AgiEngagement = {
      id: Date.now(), organization_id: payload.organization_id, created_by_staff_id: 1,
      name: payload.name, description: payload.description ?? "",
      scope_definition: { target_allowlist: payload.scope.target_allowlist, forbidden_actions: payload.scope.forbidden_actions, rules_of_engagement: payload.scope.rules_of_engagement ?? "", max_session_minutes: payload.scope.max_session_minutes ?? 120 },
      status: "draft", config: payload.config ?? null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), torn_down_at: null,
    };
    return eng;
  }
  return api.post<AgiEngagement>("/admin/agi/engagements", payload);
}

export async function patchAgiEngagement(id: number, payload: { name?: string; description?: string; config?: Record<string, unknown>; status?: string }): Promise<AgiEngagement> {
  if (DEMO_MODE) { await delay(250); return { ...demoEngagements[0], id, ...payload } as unknown as AgiEngagement; }
  return api.patch<AgiEngagement>(`/admin/agi/engagements/${id}`, payload);
}

// ── Sessions ──────────────────────────────────────────────────────────────────
export async function startAgiSession(
  engagementId: number,
  instruction: string,
  opts: { autonomy?: "low" | "medium" | "high"; include_org_assets?: boolean; credentials?: { login_url: string; username: string; password: string; label?: string; otp_mode?: string } } = {},
): Promise<AgiSession> {
  if (DEMO_MODE) {
    await delay(600);
    const s: AgiSession = { id: 200, engagement_id: engagementId, started_by_staff_id: 1, container_id: "agi-ctr-200", runner_session_id: "rs-200", status: "running", started_at: new Date().toISOString(), ended_at: null, teardown_reason: null, meta: {} };
    demoSeq = 0;
    demoTx.length = 0;
    return s;
  }
  return api.post<AgiSession>(`/admin/agi/engagements/${engagementId}/sessions`, {
    instruction,
    autonomy: opts.autonomy ?? "medium",
    include_org_assets: opts.include_org_assets ?? true,
    credentials: opts.credentials ?? undefined,
  });
}

export async function getAgiSession(sessionId: number): Promise<AgiSession | null> {
  if (DEMO_MODE) { await delay(150); return demoSessions[0] ?? null; }
  try { return await api.get<AgiSession>(`/admin/agi/sessions/${sessionId}`); } catch { return null; }
}

export async function stopAgiSession(sessionId: number): Promise<AgiSession> {
  if (DEMO_MODE) { await delay(350); return { id: sessionId, engagement_id: 11, started_by_staff_id: 1, container_id: null, runner_session_id: null, status: "stopped", started_at: new Date().toISOString(), ended_at: new Date().toISOString(), teardown_reason: "operator_stop", meta: {} }; }
  return api.post<AgiSession>(`/admin/agi/sessions/${sessionId}/stop`);
}

// ── Session controls (login / registration / preflight / OTP / shell / jobs) ─

export async function setAgiCredentials(
  sessionId: number,
  payload: { login_url: string; username: string; password: string; label?: string; otp_mode?: string },
): Promise<{ ok: boolean; credentials: Record<string, unknown>; runner_warning?: string }> {
  if (DEMO_MODE) { await delay(300); return { ok: true, credentials: { login_url: payload.login_url, username: payload.username, password_set: true } }; }
  return api.post<{ ok: boolean; credentials: Record<string, unknown>; runner_warning?: string }>(`/admin/agi/sessions/${sessionId}/credentials`, payload);
}

export async function setAgiRegistration(
  sessionId: number,
  payload: { register_url: string; email?: string; username?: string; password: string; label?: string; extra_fields?: Record<string, string> },
): Promise<{ ok: boolean; registration: Record<string, unknown>; runner_warning?: string }> {
  if (DEMO_MODE) { await delay(300); return { ok: true, registration: { register_url: payload.register_url, email: payload.email ?? "", username: payload.username ?? "", password_set: true } }; }
  return api.post<{ ok: boolean; registration: Record<string, unknown>; runner_warning?: string }>(`/admin/agi/sessions/${sessionId}/registration`, payload);
}

export async function getAgiPreflight(sessionId: number): Promise<{ session_id: number; preflight: any; provided_keys: string[]; info_requests: { key: string; label: string; hint?: string }[] }> {
  if (DEMO_MODE) {
    await delay(250);
    if (demoPreflightProvided) return { session_id: sessionId, preflight: { ready: true, message: "All required info provided." }, provided_keys: ["package_name", "apk_url", "roe_confirmed"], info_requests: [] };
    return {
      session_id: sessionId,
      preflight: { ready: false, missing: ["package_name", "apk_url", "roe_confirmed"], message: "Additional information required for mobile dynamic analysis." },
      provided_keys: [],
      info_requests: [
        { key: "package_name", label: "Package / bundle identifier", hint: "e.g. com.example.app" },
        { key: "apk_url", label: "APK download URL", hint: "https://…/app.apk" },
        { key: "roe_confirmed", label: "Dynamic analysis authorized (true)", hint: "Set true to confirm ROE" },
      ],
    };
  }
  return api.get<{ session_id: number; preflight: any; provided_keys: string[]; info_requests: { key: string; label: string; hint?: string }[] }>(`/admin/agi/sessions/${sessionId}/preflight`);
}

let demoPreflightProvided = false;

export async function provideAgiInfo(sessionId: number, fields: Record<string, unknown>, note = ""): Promise<{ ok: boolean; preflight: any; message?: string }> {
  if (DEMO_MODE) { await delay(300); demoPreflightProvided = true; return { ok: true, preflight: { ready: true, message: "All required info provided." } }; }
  return api.post<{ ok: boolean; preflight: any; message?: string }>(`/admin/agi/sessions/${sessionId}/info`, { fields, note });
}

export async function provideAgiOtp(sessionId: number, otp: string, jobId?: string): Promise<any> {
  if (DEMO_MODE) { await delay(250); return { ok: true, delivered: true, job_id: jobId ?? null }; }
  return api.post<any>(`/admin/agi/sessions/${sessionId}/otp`, { otp, job_id: jobId ?? undefined });
}

export async function runAgiShell(sessionId: number, command: string, background = false, waitOtp = false): Promise<any> {
  if (DEMO_MODE) { await delay(300); return { ok: true, stdout: "demo: command accepted in engagement container", background, wait_otp: waitOtp }; }
  return api.post<any>(`/admin/agi/sessions/${sessionId}/shell`, { command, background, wait_otp: waitOtp });
}

export async function listAgiJobs(sessionId: number): Promise<any[]> {
  if (DEMO_MODE) { await delay(250); return [{ job_id: "job-1", command: "wait_otp", status: "running", waiting_otp: true }]; }
  const res = await api.get<any>(`/admin/agi/sessions/${sessionId}/jobs`);
  if (Array.isArray(res)) return res;
  if (res && Array.isArray((res as any).jobs)) return (res as any).jobs;
  return [];
}

export async function agiChat(sessionId: number, message: string): Promise<Record<string, unknown>> {
  if (DEMO_MODE) {
    await delay(400);
    return { reply: "Understood — continuing within the approved scope.", message: "Understood" };
  }
  return api.post<Record<string, unknown>>(`/admin/agi/sessions/${sessionId}/chat`, { message });
}

export async function loadAgiTranscript(sessionId: number, afterSeq: number): Promise<AgiTranscriptChunk[]> {
  if (DEMO_MODE) {
    await delay(400);
    const lines = [
      { role: "system", content: "[engine] Engagement container provisioned · scope guard loaded" },
      { role: "assistant", content: "Plan: read-only recon of allowlisted hosts, then propose active verification steps for your approval." },
      { role: "tool", content: "httpx -silent -status-code -title https://app.acme-lab.example", meta: { tool: "httpx", action_class: "read" } },
      { role: "tool", content: "HTTP 200 · title \"Acme Lab Portal\" · server nginx", meta: { tool: "httpx", action_class: "read" } },
      { role: "assistant", content: "Recon complete. Proposing a state-changing verification step for your approval." },
    ];
    const idx = demoSeq;
    if (idx < lines.length) {
      const chunk: AgiTranscriptChunk = { seq: idx + 1, role: lines[idx].role, content: lines[idx].content, meta: lines[idx].meta ?? null, created_at: new Date().toISOString() };
      demoTx.push(chunk);
      demoSeq += 1;
    }
    return demoTx.filter((t) => t.seq > afterSeq);
  }
  const res = await api.get<AgiTranscriptChunk[]>(`/admin/agi/sessions/${sessionId}/transcript?after_seq=${afterSeq}`);
  return Array.isArray(res) ? res : [];
}

// ── Actions / approvals ───────────────────────────────────────────────────────
export async function loadAgiPendingActions(sessionId: number): Promise<AgiAction[]> {
  if (DEMO_MODE) { await delay(250); return demoActions; }
  const res = await api.get<AgiAction[]>(`/admin/agi/sessions/${sessionId}/actions/pending`);
  return Array.isArray(res) ? res : [];
}

export async function decideAgiAction(actionId: number, approve: boolean, notes = "", forceSingle = true): Promise<AgiAction> {
  if (DEMO_MODE) {
    await delay(300);
    const a = demoActions.find((x) => x.id === actionId);
    if (a) { a.status = approve ? "approved" : "rejected"; a.decided_at = new Date().toISOString(); a.decision_notes = notes; }
    return a ?? { id: actionId, session_id: 0, action_type: "state_changing", tool_name: null, proposed_command: "", rationale: "", status: "rejected", approved_by_staff_id: null, decision_notes: "", result_summary: null, created_at: new Date().toISOString(), decided_at: null, executed_at: null };
  }
  return api.post<AgiAction>(`/admin/agi/actions/${actionId}/decide?force_single=${forceSingle}`, { approve, notes });
}

// ── Skills ────────────────────────────────────────────────────────────────────
export async function loadAgiSkills(): Promise<AgiSkill[]> {
  if (DEMO_MODE) { await delay(250); return demoSills; }
  const res = await api.get<AgiSkill[]>("/admin/agi/skills?limit=100");
  return Array.isArray(res) ? res : [];
}

export async function upsertAgiSkill(payload: { document: Record<string, unknown>; status?: string; organization_id?: number | null }): Promise<AgiSkill> {
  if (DEMO_MODE) { await delay(300); return demoSills[0]; }
  return api.post<AgiSkill>("/admin/agi/skills", payload);
}

export async function loadAgiSkillSchema(): Promise<any | null> {
  if (DEMO_MODE) { await delay(200); return { skill_document: { type: "object" }, engagement_config: { type: "object" } }; }
  try { return await api.get<any>("/admin/agi/skills/schema"); } catch { return null; }
}

export async function resolvedAgiSkills(engagementId: number): Promise<AgiSkill[]> {
  if (DEMO_MODE) { await delay(250); return demoSills; }
  try {
    const res = await api.get<{ skills: AgiSkill[] }>(`/admin/agi/engagements/${engagementId}/skills/resolved`);
    return res?.skills ?? [];
  } catch { return []; }
}

// ── Findings ──────────────────────────────────────────────────────────────────
export async function loadAgiFindings(sessionId: number): Promise<AgiFinding[]> {
  if (DEMO_MODE) { await delay(250); return demoFindings; }
  try {
    const res = await api.get<{ findings: AgiFinding[] }>(`/admin/agi/sessions/${sessionId}/findings`);
    return res?.findings ?? [];
  } catch { return []; }
}

export async function promoteAgiFinding(sessionId: number, findingId: string, assetId?: number): Promise<any> {
  if (DEMO_MODE) { await delay(300); return { ok: true, risk_id: 77 }; }
  return api.post<any>(`/admin/agi/sessions/${sessionId}/findings/${findingId}/promote${assetId ? `?asset_id=${assetId}` : ""}`);
}

export async function setAgiFindingStatus(sessionId: number, findingId: string, status: string, notes = ""): Promise<any> {
  if (DEMO_MODE) { await delay(250); return { ok: true }; }
  return api.post<any>(`/admin/agi/sessions/${sessionId}/findings/${findingId}/status`, { status, notes });
}

// ── Tool installs (admin provision queue) ─────────────────────────────────────
export async function loadAgiToolInstalls(status = "pending_admin"): Promise<AgiToolInstallRequest[]> {
  if (DEMO_MODE) { await delay(250); return demoToolInstalls; }
  const res = await api.get<{ items: AgiToolInstallRequest[] }>(`/admin/agi/tool-installs?status=${status}&limit=100`);
  return res?.items ?? [];
}

export async function decideAgiToolInstall(requestId: number, provision: boolean, notes = ""): Promise<AgiToolInstallRequest> {
  if (DEMO_MODE) { await delay(300); return { ...demoToolInstalls[0], id: requestId, status: provision ? "provisioned" : "rejected", decided_at: new Date().toISOString() }; }
  return api.post<AgiToolInstallRequest>(`/admin/agi/tool-installs/${requestId}/decide`, { provision, notes });
}

// ── Errors ────────────────────────────────────────────────────────────────────
export function agiErrorDetail(err: unknown): { message: string; code?: string } {
  if (err instanceof ApiError) {
    const detail = err.detail as Record<string, unknown> | null;
    return {
      message: typeof detail?.message === "string" ? detail.message : err.message,
      code: typeof detail?.code === "string" ? detail.code : undefined,
    };
  }
  return { message: err instanceof Error ? err.message : "Request failed" };
}

// ── SSE terminal stream (staff) ───────────────────────────────────────────────
// GET /admin/agi/sessions/{id}/stream — proxied from the runner. Browser
// EventSource can't send our Authorization header, so use fetch + ReadableStream.
export async function streamAgiSession(
  sessionId: number,
  onEvent: (event: string, data: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/agi/sessions/${sessionId}/stream`, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${sessionStorage.getItem("staff_access_token") ?? ""}`,
    },
    signal,
  });
  if (!res.ok) {
    let detail: unknown = `Stream failed: ${res.status}`;
    try { detail = (await res.json()).detail ?? detail; } catch { /* non-JSON */ }
    throw new ApiError(res.status, detail);
  }
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const block of parts) {
      let event = "message";
      const dataLines: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (!dataLines.length) continue;
      onEvent(event, dataLines.join("\n"));
    }
  }
}
