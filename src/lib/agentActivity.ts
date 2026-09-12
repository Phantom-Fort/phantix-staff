// Agent activity (staff) — the same rows the customer sees, across every org.
// Mirrors GET /admin/ai/agent-activity (settings.py). Support reads this to answer
// "what did the agent do for this customer, and did it stay inside the acting
// user's permissions?" without opening the customer's database.
import { api } from "./api";

export interface AgentAction {
  id: number;
  organization_id: number;
  event_id?: string | null;
  run_id?: string | null;
  domain?: string | null;
  tool?: string | null;
  intent?: string | null;
  params?: string | null;
  authorized?: boolean | null;
  context?: string[];
  status: string;
  error?: string | null;
  created_at?: string | null;
  evidence_hash?: string | null;
  response_hash?: string | null;
}

export interface AgentActivityResponse {
  items: AgentAction[];
  total: number;
  limit: number;
  offset: number;
  summary?: { returned?: number; denied_or_failed?: number };
}

export interface AgentActivityFilter {
  organization_id?: number;
  status?: string;
  domain?: string;
  tool?: string;
  limit?: number;
  offset?: number;
}

export function buildAgentActivityQuery(filter: AgentActivityFilter): string {
  const q = new URLSearchParams();
  if (filter.organization_id != null) q.set("organization_id", String(filter.organization_id));
  if (filter.status) q.set("status", filter.status);
  if (filter.domain) q.set("domain", filter.domain);
  if (filter.tool) q.set("tool", filter.tool);
  if (filter.limit != null) q.set("limit", String(filter.limit));
  if (filter.offset != null) q.set("offset", String(filter.offset));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function loadAgentActivity(filter: AgentActivityFilter = {}) {
  return api.get<AgentActivityResponse>(`/admin/ai/agent-activity${buildAgentActivityQuery(filter)}`);
}

export function isDenied(row: AgentAction): boolean {
  return String(row.status || "").toLowerCase() === "failed";
}
