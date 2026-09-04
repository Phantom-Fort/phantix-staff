import React from "react";
import { Activity, Radio, RefreshCw, Zap } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, TableSkeleton, EmptyState } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { api, DEMO_MODE } from "@/lib/api";
import { cx } from "@/lib/utils";

type BusEvent = { event_type: string; subscribers: number; description?: string; category?: string };

const demoEvents: BusEvent[] = [
  { event_type: "asset.created", subscribers: 3, category: "asset", description: "New asset added to inventory" },
  { event_type: "asset.updated", subscribers: 2, category: "asset", description: "Asset metadata changed" },
  { event_type: "scan.completed", subscribers: 5, category: "scan", description: "Scan job finished" },
  { event_type: "finding.created", subscribers: 6, category: "finding", description: "New finding reported by scanner" },
  { event_type: "finding.verified", subscribers: 4, category: "finding", description: "Finding verification status updated" },
  { event_type: "risk.created", subscribers: 3, category: "risk", description: "New risk registered" },
  { event_type: "risk.updated", subscribers: 3, category: "risk", description: "Risk score or status changed" },
  { event_type: "alert.sent", subscribers: 2, category: "alert", description: "Alert notification dispatched" },
  { event_type: "compliance.assessment.completed", subscribers: 2, category: "compliance", description: "Framework assessment finished" },
  { event_type: "report.generated", subscribers: 2, category: "report", description: "Report ready for download" },
  { event_type: "vapt.campaign.started", subscribers: 4, category: "vapt", description: "VAPT campaign began" },
  { event_type: "vapt.campaign.completed", subscribers: 4, category: "vapt", description: "VAPT campaign finished" },
];

export default function BusDiagnostics() {
  const { data: events, loading, refresh } = useResource<BusEvent[]>(
    async (signal) => {
      if (DEMO_MODE) return demoEvents;
      const raw = await api.get<any>("/admin/bus/events");
      const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
      return items as BusEvent[];
    },
    [],
  );

  const data = DEMO_MODE ? demoEvents : (events && events.length ? events : []);
  const categories = [...new Set((data || []).map((e) => e.category || "general"))];

  return (
    <div>
      <PageHeader
        title="Event Bus Diagnostics"
        description="Engine event catalog --- debug which engines listen to which events across the platform"
        actions={
          <button onClick={refresh} className="btn-ghost text-sm px-3 py-1.5">
            <RefreshCw size={14} />
          </button>
        }
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Event Catalog" subtitle={`${data.length} event types registered`} />
          {loading ? (
            <TableSkeleton rows={8} />
          ) : (
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {data.map((evt) => (
                <div key={evt.event_type} className="flex items-center justify-between rounded-lg bg-phantix-800/40 px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Radio size={14} className={cx("shrink-0", evt.subscribers > 3 ? "text-emerald-400" : "text-slate-500")} />
                    <div className="min-w-0">
                      <p className="text-sm font-mono text-slate-200 truncate">{evt.event_type}</p>
                      {evt.description && <p className="text-xs text-slate-500 truncate">{evt.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {evt.category && <span className="chip text-[10px] text-phantix-300 bg-phantix-500/10 border-phantix-500/20">{evt.category}</span>}
                    <span className="text-xs font-mono text-slate-400">{evt.subscribers} subs</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="By Category" subtitle="Subscriber distribution per domain" />
          <div className="space-y-3">
            {categories.map((cat) => {
              const items = data.filter((e) => (e.category || "general") === cat);
              const totalSubs = items.reduce((s, e) => s + e.subscribers, 0);
              return (
                <div key={cat} className="rounded-lg bg-phantix-800/40 px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-200 capitalize">{cat}</span>
                    <span className="text-xs text-slate-500">{items.length} events / {totalSubs} subscribers</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-phantix-700/50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-phantix-400 to-gold-400"
                      style={{ width: `${Math.min(100, (totalSubs / 30) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
