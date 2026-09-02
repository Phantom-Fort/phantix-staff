import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Eye, Users, MousePointerClick, Globe, RefreshCw } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader, ErrorState, PageHeader, Spinner, StatCard } from "@/components/ui";
import { api } from "@/lib/api";
import { cx } from "@/lib/utils";

// ── Free-tier, first-party analytics ─────────────────────────────────────────
// The four Phantix apps beacon page views to POST /api/v1/analytics/collect
// (cookieless: path, referrer, coarse screen, UTM — no PII). This dashboard
// renders the aggregated summary from GET /api/v1/admin/analytics/summary.

interface AnalyticsSummary {
  days: number;
  totals: { pageviews: number; visitors: number; sessions: number };
  daily: Array<{ date: string; pageviews: number; visitors: number }>;
  top_pages: Array<{ path: string; pageviews: number }>;
  referrers: Array<{ referrer: string; visits: number }>;
  devices?: Array<{ device: string; visits: number }>;
  utm?: Array<{ source: string; visits: number }>;
  apps?: Array<{ app: string; pageviews: number }>;
}

const RANGES = [7, 30, 90] as const;

function fmt(n: number | undefined | null): string {
  return Number(n ?? 0).toLocaleString();
}

export default function Analytics() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (range: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ ok?: boolean } & AnalyticsSummary>(`/admin/analytics/summary?days=${range}`);
      setData({
        days: Number(res.days ?? range),
        totals: res.totals ?? { pageviews: 0, visitors: 0, sessions: 0 },
        daily: Array.isArray(res.daily) ? res.daily : [],
        top_pages: Array.isArray(res.top_pages) ? res.top_pages : [],
        referrers: Array.isArray(res.referrers) ? res.referrers : [],
        devices: Array.isArray(res.devices) ? res.devices : [],
        utm: Array.isArray(res.utm) ? res.utm : [],
        apps: Array.isArray(res.apps) ? res.apps : [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const chartData = useMemo(
    () =>
      (data?.daily ?? []).map((d) => ({
        date: String(d.date).slice(5), // MM-DD
        pageviews: Number(d.pageviews ?? 0),
        visitors: Number(d.visitors ?? 0),
      })),
    [data],
  );

  const hasData = (data?.totals?.pageviews ?? 0) > 0 || chartData.length > 0;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Analytics"
        description="First-party, cookieless traffic analytics across the Phantix Labs surfaces — landing, command centre, platform and demo. No third-party trackers."
        actions={
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
        }
      />

      {loading && !data ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      ) : error && !data ? (
        <ErrorState
          title="Analytics unavailable"
          body={`${error} The summary endpoint (GET /api/v1/admin/analytics/summary) may not be deployed yet — the apps are already collecting page views.`}
          onRetry={() => void load(days)}
        />
      ) : !hasData ? (
        <Card className="p-10 text-center">
          <BarChart3 size={28} className="mx-auto text-slate-600" />
          <h3 className="mt-4 font-display text-base font-semibold text-slate-200">No analytics data yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            The four apps are beaconing page views to <code className="rounded bg-phantix-950/80 px-1 py-0.5 font-mono text-[11px] text-gold-200/90">/api/v1/analytics/collect</code>.
            Once the backend aggregates them, pageviews, visitors, referrers and top pages will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Totals */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Pageviews" value={fmt(data?.totals?.pageviews)} icon={<Eye size={18} />} trendLabel={`last ${data?.days ?? days} days`} />
            <StatCard label="Visitors" value={fmt(data?.totals?.visitors)} icon={<Users size={18} />} trendLabel="cookieless sessions" />
            <StatCard label="Sessions" value={fmt(data?.totals?.sessions)} icon={<MousePointerClick size={18} />} trendLabel="per-tab session ids" />
            <StatCard
              label="Views / visitor"
              value={data?.totals?.visitors ? (data.totals.pageviews / data.totals.visitors).toFixed(1) : "—"}
              icon={<Globe size={18} />}
              trendLabel="engagement depth"
            />
          </div>

          {/* Daily series */}
          <Card>
            <CardHeader title="Traffic" subtitle={`Pageviews and visitors · last ${data?.days ?? days} days`} />
            <div className="h-72 w-full px-2 pb-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pvFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#E8B54D" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#E8B54D" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="visFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5A7BD6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#5A7BD6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(51,87,168,0.25)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={{ stroke: "rgba(51,87,168,0.4)" }} tickLine={false} minTickGap={24} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "#0D1B3D", border: "1px solid rgba(51,87,168,0.5)", borderRadius: 12, color: "#e2e8f0", fontSize: 12 }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                  <Area type="monotone" dataKey="pageviews" stroke="#E8B54D" strokeWidth={2} fill="url(#pvFill)" name="Pageviews" />
                  <Area type="monotone" dataKey="visitors" stroke="#5A7BD6" strokeWidth={2} fill="url(#visFill)" name="Visitors" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Top pages" subtitle="Most visited paths across all apps" />
              <BreakdownList rows={(data?.top_pages ?? []).map((r) => ({ label: r.path, value: r.pageviews }))} mono />
            </Card>
            <Card>
              <CardHeader title="Referrers" subtitle="Where visitors come from" />
              <BreakdownList rows={(data?.referrers ?? []).map((r) => ({ label: r.referrer || "(direct / none)", value: r.visits }))} />
            </Card>
            {(data?.devices?.length ?? 0) > 0 && (
              <Card>
                <CardHeader title="Devices" subtitle="Coarse screen classes" />
                <BreakdownList rows={(data?.devices ?? []).map((r) => ({ label: r.device, value: r.visits }))} />
              </Card>
            )}
            {(data?.apps?.length ?? 0) > 0 && (
              <Card>
                <CardHeader title="By app" subtitle="Landing · Command centre · Platform" />
                <BreakdownList rows={(data?.apps ?? []).map((r) => ({ label: r.app, value: r.pageviews }))} mono />
              </Card>
            )}
            {(data?.utm?.length ?? 0) > 0 && (
              <Card>
                <CardHeader title="Campaigns (UTM)" subtitle="utm_source attribution" />
                <BreakdownList rows={(data?.utm ?? []).map((r) => ({ label: r.source, value: r.visits }))} mono />
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BreakdownList({ rows, mono = false }: { rows: Array<{ label: string; value: number }>; mono?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="px-5 pb-6 text-sm text-slate-600">No data yet.</p>;
  return (
    <div className="space-y-2 px-5 pb-5">
      {rows.slice(0, 10).map((r, i) => (
        <div key={`${r.label}-${i}`} className="flex items-center gap-3">
          <span className={cx("min-w-0 flex-1 truncate text-xs text-slate-300", mono && "font-mono")}>{r.label}</span>
          <span className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-phantix-800/60">
            <span className="block h-full rounded-full bg-gold-400/80" style={{ width: `${Math.max(4, (r.value / max) * 100)}%` }} />
          </span>
          <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-slate-400">{fmt(r.value)}</span>
        </div>
      ))}
    </div>
  );
}