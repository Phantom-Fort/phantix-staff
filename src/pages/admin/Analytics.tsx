import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3, Building2, Inbox, LifeBuoy, RefreshCw, Sparkles, Ticket, UserCog, Users,
} from "lucide-react";
import { Card, CardHeader, ErrorState, PageHeader, StatCard, StatCardSkeleton, Tabs } from "@/components/ui";
import { DemoRequestsPanel } from "@/components/DemoRequestsPanel";
import { api } from "@/lib/api";
import { cx, formatDateTime } from "@/lib/utils";

// ── Product analytics ────────────────────────────────────────────────────────
// GET /api/v1/admin/analytics/summary?days= (staff-admin gated). This is the
// "how is the product being used" plane, aggregated on demand from the platform
// DB — organizations, users, leads, support load and AI credit burn. It is
// deliberately not web-traffic analytics: there is no pageview series behind it.
//
// The second tab closes the loop on the one lead-capture flow the marketing
// site has: demo requests triaged via GET/PATCH /api/v1/admin/demo-requests.

interface AnalyticsSummary {
  window_days: number;
  generated_at: string | null;
  organizations: { total: number; active: number; verified: number };
  users: { org_users: number; staff: number };
  /** Also carries a dynamic `last_{days}d` key — read via windowCount(). */
  demo_requests: Record<string, number>;
  support: { open_tickets: number };
  growth: { coupons_redeemed: number };
  ai_credits: { entries: number; credits_consumed: number };
}

const RANGES = [7, 30, 90] as const;

type Tab = "product" | "leads";

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function fmt(v: unknown): string {
  return n(v).toLocaleString();
}

/** The window bucket is keyed `last_{days}d`, so resolve it by shape not name. */
function windowCount(demo: Record<string, number> | undefined, days: number): number {
  if (!demo) return 0;
  const exact = demo[`last_${days}d`];
  if (exact != null) return n(exact);
  const key = Object.keys(demo).find((k) => /^last_\d+d$/.test(k));
  return key ? n(demo[key]) : 0;
}

function normalize(raw: any, days: number): AnalyticsSummary {
  const r = (raw ?? {}) as Record<string, any>;
  const obj = (v: unknown): Record<string, any> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {};
  const orgs = obj(r.organizations);
  const users = obj(r.users);
  const demo = obj(r.demo_requests);
  const support = obj(r.support);
  const growth = obj(r.growth);
  const credits = obj(r.ai_credits);
  return {
    window_days: n(r.window_days) || days,
    generated_at: r.generated_at ? String(r.generated_at) : null,
    organizations: { total: n(orgs.total), active: n(orgs.active), verified: n(orgs.verified) },
    users: { org_users: n(users.org_users), staff: n(users.staff) },
    demo_requests: Object.fromEntries(Object.entries(demo).map(([k, v]) => [k, n(v)])),
    support: { open_tickets: n(support.open_tickets) },
    growth: { coupons_redeemed: n(growth.coupons_redeemed) },
    ai_credits: { entries: n(credits.entries), credits_consumed: n(credits.credits_consumed) },
  };
}

export default function Analytics() {
  const [tab, setTab] = useState<Tab>("product");
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (range: number) => {
    setLoading(true);
    setError(null);
    try {
      setData(normalize(await api.get<any>(`/admin/analytics/summary?days=${range}`), range));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the analytics summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const leadsInWindow = useMemo(() => windowCount(data?.demo_requests, days), [data, days]);
  // credits_consumed sums the negative entries, so its magnitude is the burn.
  const creditsBurned = Math.abs(n(data?.ai_credits.credits_consumed));

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Analytics"
        description="Product usage across the Phantix Labs platform — tenants, users, lead flow, support load and AI credit burn — aggregated on demand from the platform database."
        actions={tab !== "product" ? null : (
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-phantix-700/50">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setDays(r)}
                  className={cx(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    days === r ? "bg-phantix-800 text-white" : "text-slate-400 hover:bg-phantix-800/60 hover:text-slate-200",
                  )}
                >
                  {r}d
                </button>
              ))}
            </div>
            <button onClick={() => void load(days)} className="btn-ghost px-3 py-1.5 text-sm" title="Refresh">
              <RefreshCw size={14} className={cx(loading && "animate-spin")} /> Refresh
            </button>
          </div>
        )}
      />

      <Tabs
        active={tab}
        onChange={(id) => setTab(id as Tab)}
        tabs={[
          { id: "product", label: <span className="flex items-center gap-1.5"><BarChart3 size={14} /> Product</span> },
          { id: "leads", label: <span className="flex items-center gap-1.5"><Inbox size={14} /> Demo requests</span> },
        ]}
      />

      {tab === "leads" ? (
        <DemoRequestsPanel />
      ) : loading && !data ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <StatCardSkeleton key={i} />)}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ opacity: 1 - i * 0.09 }}>
                <div className="skeleton h-4 w-36 rounded" />
                <div className="skeleton mt-2 h-2.5 w-48 max-w-full rounded" />
                <div className="mt-4 space-y-2.5">
                  {[0, 1, 2].map((r) => (
                    <div key={r} className="flex items-center justify-between gap-4">
                      <div className="skeleton h-3 w-40 max-w-[60%] rounded" />
                      <div className="skeleton h-3 w-12 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : error && !data ? (
        <ErrorState
          title="Analytics unavailable"
          body={`${error} The summary is served by GET /api/v1/admin/analytics/summary and requires a staff admin account.`}
          onRetry={() => void load(days)}
        />
      ) : (
        <div className="space-y-5">
          {/* Headline counters */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Organizations"
              value={fmt(data?.organizations.total)}
              icon={<Building2 size={18} />}
              trendLabel={`${fmt(data?.organizations.active)} active · ${fmt(data?.organizations.verified)} verified`}
            />
            <StatCard
              label="Org users"
              value={fmt(data?.users.org_users)}
              icon={<Users size={18} />}
              trendLabel="across all tenants"
            />
            <StatCard
              label="Demo requests"
              value={fmt(data?.demo_requests.total)}
              icon={<Inbox size={18} />}
              trendLabel={`${fmt(leadsInWindow)} in the last ${data?.window_days ?? days} days`}
            />
            <StatCard
              label="Open tickets"
              value={fmt(data?.support.open_tickets)}
              icon={<LifeBuoy size={18} />}
              trendLabel="open or pending"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Tenants" subtitle="Organization lifecycle" action={<Building2 size={15} className="text-gold-400" />} />
              <Rows
                rows={[
                  { label: "Total organizations", value: n(data?.organizations.total) },
                  { label: "Active", value: n(data?.organizations.active) },
                  { label: "Domain verified", value: n(data?.organizations.verified) },
                ]}
              />
            </Card>

            <Card>
              <CardHeader title="People" subtitle="Accounts on the platform" action={<UserCog size={15} className="text-phantix-300" />} />
              <Rows
                rows={[
                  { label: "Organization users", value: n(data?.users.org_users) },
                  { label: "Platform staff", value: n(data?.users.staff) },
                ]}
              />
            </Card>

            <Card>
              <CardHeader
                title="Lead funnel"
                subtitle="Captured from the landing demo tour"
                action={<Inbox size={15} className="text-emerald-400" />}
              />
              <Rows
                rows={[
                  { label: "All time", value: n(data?.demo_requests.total) },
                  { label: "Awaiting triage (new)", value: n(data?.demo_requests.new), emphasis: true },
                  { label: `Last ${data?.window_days ?? days} days`, value: leadsInWindow },
                ]}
              />
              <button
                onClick={() => setTab("leads")}
                className="mt-3 text-xs text-gold-300 transition-colors hover:text-gold-200"
              >
                Open the demo-request queue →
              </button>
            </Card>

            <Card>
              <CardHeader title="Growth & AI usage" subtitle="Coupon redemptions and credit burn" action={<Sparkles size={15} className="text-gold-400" />} />
              <Rows
                rows={[
                  { label: "Coupons redeemed", value: n(data?.growth.coupons_redeemed) },
                  { label: "AI credit entries", value: n(data?.ai_credits.entries) },
                  { label: "Credits consumed", value: creditsBurned },
                ]}
              />
            </Card>
          </div>

          <p className="flex items-center gap-2 text-[11px] text-slate-600">
            <Ticket size={11} />
            Aggregated live from the platform database — no warehouse, no third-party trackers, no PII beyond counts.
            {data?.generated_at && <span>· generated {formatDateTime(data.generated_at)}</span>}
          </p>
        </div>
      )}
    </div>
  );
}

function Rows({ rows }: { rows: Array<{ label: string; value: number; emphasis?: boolean }> }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className={cx("min-w-0 flex-1 truncate text-xs", r.emphasis ? "text-slate-200" : "text-slate-400")}>
            {r.label}
          </span>
          <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-phantix-800/60">
            <span
              className={cx("block h-full rounded-full", r.emphasis ? "bg-gold-400" : "bg-gold-400/50")}
              style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }}
            />
          </span>
          <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-slate-200">
            {r.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
