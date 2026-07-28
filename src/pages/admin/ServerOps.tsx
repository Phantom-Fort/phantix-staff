import React from "react";
import { Server, Cpu, HardDrive, RefreshCw, Zap, Activity, Database, CheckCircle2, AlertTriangle } from "lucide-react";
import { PageHeader, Card, CardHeader, StatCard, TableSkeleton, ProgressRing } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { api, DEMO_MODE } from "@/lib/api";

type ServerOverview = { health: { score: number; label: string }; version: string; environment: string; process: { pid: number; rss_mb: number; python: string }; related_processes: { pid: number; role: string; rss_mb: number; cmdline: string }[]; resources: { cpu_count_logical: number; memory: { total_mb: number; used_percent: number }; disk: { used_percent: number } }; database_pool: { size: number; checkedin: number; checkedout: number }; recommendations: { severity: string; title: string; detail: string }[]; optimize_actions: string[]; celery: { worker_count: number } };

const demoServer: ServerOverview = {
  health: { score: 100, label: "optimal" },
  version: "0.1.0", environment: "development",
  process: { pid: 79485, rss_mb: 191, python: "3.12.3" },
  related_processes: [
    { pid: 79485, role: "api", rss_mb: 191, cmdline: "uvicorn app.main:app --host 0.0.0.0 --port 8000" },
    { pid: 74371, role: "celery_worker", rss_mb: 59, cmdline: "celery worker -Q scans,vapt,alerts" },
    { pid: 74376, role: "celery_beat", rss_mb: 57, cmdline: "celery beat -S redbeat.RedBeatScheduler" },
  ],
  resources: { cpu_count_logical: 8, memory: { total_mb: 11882, used_percent: 18 }, disk: { used_percent: 5 } },
  database_pool: { size: 30, checkedin: 1, checkedout: 1 },
  recommendations: [{ severity: "info", title: "No critical issues", detail: "Runtime looks healthy." }],
  optimize_actions: ["gc_collect", "dispose_db_pool", "clear_idle_tool_locks", "all"],
  celery: { worker_count: 5 },
};

export default function ServerOps() {
  const { toast } = useStore();

  const server = useResource<ServerOverview>(
    async (signal) => {
      if (DEMO_MODE) return demoServer;
      return api.get<ServerOverview>("/admin/server/overview");
    },
    [],
  );

  const d = server.data ?? (DEMO_MODE ? demoServer : null);

  const handleOptimize = async () => {
    try {
      await api.post("/admin/server/optimize", { actions: ["all"] });
      toast("success", "Optimization started");
      server.refresh();
    } catch (e) {
      toast("error", "Optimize failed", e instanceof Error ? e.message : "");
    }
  };

  return (
    <div>
      <PageHeader
        title="Server Operations"
        description={`${d?.version ?? ""} · ${d?.environment ?? ""} · PID ${d?.process?.pid ?? "---"}`}
        actions={
          <button onClick={() => server.refresh()} className="btn-ghost text-sm px-3 py-1.5" disabled={server.loading}>
            <RefreshCw size={14} className={server.loading ? "animate-spin" : ""} />
          </button>
        }
      />

      {server.loading ? <TableSkeleton rows={4} /> : !d ? (
        <div className="flex items-center justify-center py-16 text-sm text-slate-500">Server data unavailable.</div>
      ) : (
        <>
          {/* Health + Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <Card className="flex flex-col items-center justify-center py-4">
              <ProgressRing value={d.health.score} size={80} stroke={5} />
              <p className="text-xs text-slate-400 mt-2 capitalize">{d.health.label}</p>
            </Card>
            <StatCard label="Python" value={d.process.python} icon={<Server size={18} />} />
            <StatCard label="API Memory" value={`${d.process.rss_mb} MB`} icon={<HardDrive size={18} />} />
            <StatCard label="CPU Cores" value={`${d.resources.cpu_count_logical}`} icon={<Cpu size={18} />} />
            <StatCard label="DB Pool" value={`${d.database_pool.checkedout}/${d.database_pool.size}`} icon={<Database size={18} />} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Processes */}
            <Card>
              <CardHeader title="Processes" subtitle={`${d.related_processes.length} processes · ${d.celery.worker_count} celery workers`} />
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {d.related_processes.map((p) => (
                  <div key={p.pid} className="flex items-center justify-between rounded bg-phantix-800/30 px-2.5 py-1.5 text-xs">
                    <div className="min-w-0">
                      <span className="text-slate-300 truncate block">{p.cmdline.slice(0, 60)}{p.cmdline.length > 60 ? "..." : ""}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="chip text-[10px] text-slate-400 bg-slate-400/10 border-slate-500/30">{p.role}</span>
                      <span className="font-mono text-slate-500">{p.rss_mb} MB</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Resources + Actions */}
            <Card>
              <CardHeader title="Resources & Actions" />
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs"><span className="text-slate-400">Memory</span><span className="text-white">{d.resources.memory.used_percent}% of {(d.resources.memory.total_mb / 1024).toFixed(1)} GB</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-400">Disk</span><span className="text-white">{d.resources.disk.used_percent}% used</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-400">DB Pool</span><span className="text-white">{d.database_pool.checkedin} idle / {d.database_pool.checkedout} active / {d.database_pool.size} max</span></div>
                </div>

                {d.recommendations.length > 0 && (
                  <div className="pt-2 border-t border-phantix-700/30">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Recommendations</p>
                    {d.recommendations.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs py-0.5">
                        <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-slate-300">{r.title}</p>
                          <p className="text-slate-500">{r.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={handleOptimize} className="btn-secondary w-full text-sm">
                  <Zap size={14} /> Optimize Server
                </button>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
