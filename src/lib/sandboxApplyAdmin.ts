/** Landing sandbox-apply Node API (not Phantix main backend). */
const RAW = (import.meta.env.VITE_SANDBOX_APPLY_API as string | undefined)?.replace(/\/+$/, "") ?? "";
const KEY = (import.meta.env.VITE_SANDBOX_STAFF_KEY as string | undefined) ?? "";

export const SANDBOX_APPLY_API = RAW;
export const SANDBOX_STAFF_KEY_CONFIGURED = !!KEY && !!RAW;

export type LandingApplication = {
  id: string;
  organization_name: string;
  website?: string;
  contact_name: string;
  contact_email: string;
  country?: string;
  industry?: string;
  team_size?: string;
  use_case?: string;
  hear_about?: string;
  status: string;
  staff_notes?: string;
  created_at: string;
  updated_at: string;
};

export type ApplyStats = {
  max: number;
  seatsUsed: number;
  seatsRemaining: number;
  open: boolean;
  pending: number;
  approved: number;
  enrolled: number;
  waitlist: number;
  rejected: number;
  totalApplications: number;
};

async function staffFetch(path: string, init?: RequestInit) {
  if (!RAW || !KEY) throw new Error("Set VITE_SANDBOX_APPLY_API and VITE_SANDBOX_STAFF_KEY");
  const res = await fetch(`${RAW}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Sandbox-Staff-Key": KEY,
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.detail === "string" ? data.detail : res.statusText);
  return data;
}

export async function listLandingApplications(status?: string): Promise<{
  items: LandingApplication[];
  stats: ApplyStats;
}> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await staffFetch(`/api/sandbox/applications${q}`);
  return {
    items: Array.isArray(data.items) ? data.items : [],
    stats: data.stats,
  };
}

export async function patchLandingApplication(
  id: string,
  body: { status?: string; staff_notes?: string },
): Promise<{ application: LandingApplication; stats: ApplyStats }> {
  return staffFetch(`/api/sandbox/applications/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteLandingApplication(id: string): Promise<void> {
  await staffFetch(`/api/sandbox/applications/${encodeURIComponent(id)}`, { method: "DELETE" });
}
