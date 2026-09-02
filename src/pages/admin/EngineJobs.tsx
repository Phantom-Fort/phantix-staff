import React, { useState, useEffect } from "react";
import { Zap, RefreshCw, Wifi, WifiOff, Activity, Server, Crosshair, FileText, Bell, Brain } from "lucide-react";
import { PageHeader, Card, CardHeader, StatCard, AnimatedNumber, ProgressBar, TableSkeleton, EmptyState, StatusBadge } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { api, DEMO_MODE, tokens, API_BASE } from "@/lib/api";
import { cx } from "@/lib/utils";

type EngineJob = { engineId: string; running: number; queued: number; paused: number; otherActive: number; totalActive: number; byOrganization: { organizationId: number; organizationName: string; running: number; totalActive: number }[]; source: string };
type JobsSnapshot = { totalActiveJobs: number; organizationsSampled: number; engines: EngineJob[]; celery: { available: boolean; workerCount: number; activeTasksByWorker: Record<string, number> }; durationMs: number };

const demoSnapshot: JobsSnapshot = {
  totalActiveJobs: 17, organizationsSampled: 12,
  engines: [
    { engineId: "scanner_engine", running: 4, queued: 2, paused: 0, otherActive: 0, totalActive: 6, byOrganization: [{ organizationId: 11, organizationName: "Acme", running: 2, totalActive: 3 }, { organizationId: 24, organizationName: "Phantom", running: 1, totalActive: 2 }], source: "security_db" },
    { engineId: "vapt_engine", running: 2, queued: 0, paused: 1, otherActive: 0, totalActive: 3, byOrganization: [], source: "platform" },
    { engineId: "reporting_engine", running: 0, queued: 1, paused: 0, otherActive: 2, totalActive: 3, byOrganization: [], source: "platform" },
    { engineId: "asset_engine", running: 1, queued: 3, paused: 0, otherActive: 0, totalActive: 4, byOrganization: [], source: "security_db" },
    { engineId: "alert_engine", running: 0, queued: 1, paused: 0, otherActive: 0, totalActive: 1, byOrganization: [], source: "platform" },
  ],
  celery: { available: true, workerCount: 4, activeTasksByWorker: { "celery@host": 5 } },
  durationMs: 180,
};

const engineIcons: Record<string, React.ReactNode> = {
  scanner_engine: <Activity size={16} />,
  vapt_engine: <Crosshair size={16} />,
  reporting_engine: <FileText size={16} />,
  asset_engine: <Server size={16} />,
  alert_engine: <Bell size={16} />,
  ai_engine: <Brain size={16} />,
};

function normalizeSnapshot(raw: any): JobsSnapshot {
  const celery = raw?.celery ?? {};
  return {
    totalActiveJobs: Number(raw?.totalActiveJobs ?? raw?.total_active_jobs ?? 0),
    organizationsSampled: Number(raw?.organizationsSampled ?? raw?.organizations_sampled ?? 0),
    engines: Array.isArray(raw?.engines) ? raw.engines : [],
    celery: {
      available: celery.available === true || celery.available === "true",
      workerCount: Number(celery.workerCount ?? celery.worker_count ?? 0),
      activeTasksByWorker: celery.activeTasksByWorker ?? celery.active_tasks_by_worker ?? {},
    },
    durationMs: Number(raw?.durationMs ?? raw?.duration_ms ?? 0),
  };
}

export default function EngineJobs() {
  const [liveConnected, setLiveConnected] = useState(false);
  const [streamData, setStreamData] = useState<JobsSnapshot | null>(null);

  const jobs = useResource<JobsSnapshot>(
    async (signal) => {
      if (DEMO_MODE) return demoSnapshot;
      return normalizeSnapshot(await api.get<any>("/admin/super/engines/jobs"));
    },
    normalizeSnapshot({}) as any,
  );

  const data = streamData || jobs.data || (DEMO_MODE ? demoSnapshot : null);

  // SSE stream (auto-reconnect with backoff)
  useEffect(() => {
    if (DEMO_MODE) { setLiveConnected(true); return; }
    const controller = new AbortController();
    let cancelled = false;
    let retryTimer: number | null = null;
    let delay = 1500;

    const connect = async () => {
      if (cancelled) return;
      try {
        const url = `${API_BASE}/admin/super/engines/jobs/stream?poll_seconds=5`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${tokens.staff}`, Accept: "text/event-stream" }, signal: controller.signal });
        if (!res.ok || !res.body) {
          if (!cancelled) setLiveConnected(false);
          scheduleReconnect();
          return;
        }
        setLiveConnected(true);
        delay = 1500;
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const chunks = buf.split("\n\n");
          buf = chunks.pop() || "";
          for (const chunk of chunks) {
            const lines = chunk.split("\n");
            let eventName = "", dataStr = "";
            for (const line of lines) {
              if (line.startsWith("event:")) eventName = line.slice(6).trim();
              if (line.startsWith("data:")) dataStr += line.slice(5).trim();
            }
            if (!dataStr || eventName === "heartbeat") continue;
            try { setStreamData(normalizeSnapshot(JSON.parse(dataStr))); } catch { /* ignore */ }
          }
        }
      } catch {
        if (!cancelled) {
          setLiveConnected(false);
          scheduleReconnect();
        }
      }
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      retryTimer = window.setTimeout(() => {
        delay = Math.min(delay * 2, 30000);
        void connect();
      }, delay);
    };

    void connect();
    return () => {
      cancelled = true;
      controller.abort();
      if (retryTimer) window.clearTimeout(retryTimer);
      setLiveConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader
        title="Engine Job Metrics"
        description="Cross-tenant active job counts per engine with live SSE updates"
        actions={
          <div className="flex items-center gap-2">
            <span className={cx("flex items-center gap-1.5 text-xs font-mono", liveConnected ? "text-emerald-400" : "text-slate-500")}>
              {liveConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {liveConnected ? "SSE Live" : "Polling"}
            </span>
            <button onClick={() => jobs.refresh()} className="btn-ghost text-sm px-3 py-1.5">
              <RefreshCw size={14} className={jobs.loading ? "animate-spin" : ""} />
            </button>
          </div>
        }
      />

      {jobs.loading && !data ? (
        <TableSkeleton rows={4} />
      ) : !data ? (
        <EmptyState icon={<Zap size={24} />} title="No data" body="Engine job data unavailable" />
      ) : (
        <>
          {/* Summary bar */}
          <div className="flex items-center gap-4 mb-4 p-3 rounded-md bg-phantix-800/40 border border-phantix-700/40 text-sm">
            <span className="text-slate-400">Total Active: <span className="text-white font-bold">{data.totalActiveJobs}</span></span>
            <span className="text-slate-400">Orgs Sampled: <span className="text-white">{data.organizationsSampled}</span></span>
            <span className="text-slate-400">Celery Workers: <span className={cx("font-mono", data.celery.available ? "text-emerald-400" : "text-severity-medium")}>{data.celery.workerCount} workers</span></span>
            <span className="text-xs text-slate-600 ml-auto">{data.durationMs}ms</span>
          </div>

          {/* Engine cards */}
          <div className="grid lg:grid-cols-3 gap-4">
            {data.engines.map((engine) => {
              const maxJobs = Math.max(engine.totalActive, 10);
              return (
                <Card key={engine.engineId} hover>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-phantix-800/70 text-gold-400">
                      {engineIcons[engine.engineId] || <Zap size={16} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-100 capitalize">{engine.engineId.replace(/_/g, " ")}</p>
                      <p className="text-[10px] text-slate-500">{engine.source}</p>
                    </div>
                    <span className="ml-auto font-display text-xl font-bold text-white">{engine.totalActive}</span>
                  </div>

                  <div className="space-y-1.5">
                    {engine.running > 0 && (
                      <div>
                        <div className="flex justify-between text-xs mb-0.5"><span className="text-slate-400">Running</span><span className="font-mono text-emerald-400">{engine.running}</span></div>
                        <ProgressBar value={(engine.running / maxJobs) * 100} color="#38BDF8" />
                      </div>
                    )}
                    {engine.queued > 0 && (
                      <div>
                        <div className="flex justify-between text-xs mb-0.5"><span className="text-slate-400">Queued</span><span className="font-mono text-severity-medium">{engine.queued}</span></div>
                        <ProgressBar value={(engine.queued / maxJobs) * 100} color="#FACC15" />
                      </div>
                    )}
                    {engine.paused > 0 && (
                      <div>
                        <div className="flex justify-between text-xs mb-0.5"><span className="text-slate-400">Paused</span><span className="font-mono text-slate-400">{engine.paused}</span></div>
                        <ProgressBar value={(engine.paused / maxJobs) * 100} color="#94A3B8" />
                      </div>
                    )}
                  </div>

                  {engine.byOrganization.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-phantix-700/30">
                      <p className="text-[10px] text-slate-500 mb-1">By Organization</p>
                      {engine.byOrganization.slice(0, 3).map((org) => (
                        <div key={org.organizationId} className="flex justify-between text-xs py-0.5">
                          <span className="text-slate-400 truncate">#{org.organizationId} {org.organizationName}</span>
                          <span className="font-mono text-slate-300">{org.totalActive} active</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
