import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Cpu, HardDrive, Database, Activity, RefreshCw, Play, Loader2, Server } from "lucide-react";
import { PageHeader, Card, CardHeader, StatCard, TableSkeleton } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { api, DEMO_MODE } from "@/lib/api";
import { cx } from "@/lib/utils";

type ServerOverview = {
  health: "healthy" | "degraded" | "unhealthy";
  version: string;
  environment: string;
  process: { pid: number; rss_mb: number; uptime_seconds: number };
  processes: { pid: number; role: string; rss_mb: number; cmdline: string }[];
  resources: { cpu_count_logical: number; memory: { total_mb: number; used_percent: number }; disk: { used_percent: number } };
  database_pool: { size: number; checkedin: number; checkedout: number };
  recommendations: { severity: string; title: string; detail: string }[];
  optimize_actions: string[];
  celery: { worker_count: number };
};

const demoServer: ServerOverview = {
  health: "healthy",
  version: "4.3.2",
  environment: "staging",
  process: { pid: 74368, rss_mb: 313, uptime_seconds: 487200 },
  processes: [
    { pid: 74368, role: "api_server", rss_mb: 313, cmdline: "uvicorn app.main:app" },
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
  const [optimizing, setOptimizing] = useState<string | null>(null);

  const { data: server, loading, refresh } = useResource<ServerOverview>(
    async () => {
      if (DEMO_MODE) return demoServer;
      const [overview, processes, resources, runtime, recommendations] = await Promise.all([
        api.get<Record<string, unknown>>("/admin/server/overview").catch(() => null),
        api.get<Record<string, unknown> | Record<string, unknown>[]>("/admin/server/processes").catch(() => null),
        api.get<Record<string, unknown>>("/admin/server/resources").catch(() => null),
        api.get<Record<string, unknown>>("/admin/server/runtime").catch(() => null),
        api.get<Record<string, unknown> | Record<string, unknown>[]>("/admin/server/recommendations").catch(() => null),
      ]);

      const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {});
      const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

      const ov = obj(overview);
      const res = obj(resources);
      const rt = obj(runtime);
      const mem = obj(res.memory);
      const disk = obj(res.disk);
      const proc = obj(ov.process);
      const pool = obj(rt.database_pool ?? rt.db_pool ?? ov.database_pool);
      const celery = obj(rt.celery ?? ov.celery);
      const processesRaw = arr<Record<string, any>>(processes ?? ov.processes);
      const recsRaw = Array.isArray(recommendations)
        ? (recommendations as Record<string, any>[])
        : arr<Record<string, any>>(obj(recommendations).items ?? obj(recommendations).recommendations);
      const actionsRaw = arr<string>(ov.optimize_actions ?? ov.actions ?? rt.optimize_actions);

      return {
        health: String(ov.health ?? ov.health_score ?? "unknown"),
        version: String(ov.version ?? ""),
        environment: String(ov.environment ?? ""),
        process: {
          pid: Number(proc.pid ?? ov.pid ?? 0),
          rss_mb: Number(proc.rss_mb ?? proc.rss ?? 0),
          uptime_seconds: Number(proc.uptime_seconds ?? proc.uptime ?? 0),
        },
        processes: processesRaw.map((p) => ({
          pid: Number(p.pid ?? 0),
          role: String(p.role ?? p.name ?? ""),
          rss_mb: Number(p.rss_mb ?? p.rss ?? 0),
          cmdline: String(p.cmdline ?? p.command ?? ""),
        })),
        resources: {
          cpu_count_logical: Number(res.cpu_count_logical ?? res.cpu_count ?? 0),
          memory: { total_mb: Number(mem.total_mb ?? 0), used_percent: Number(mem.used_percent ?? 0) },
          disk: { used_percent: Number(disk.used_percent ?? 0) },
        },
        database_pool: { size: Number(pool.size ?? 0), checkedin: Number(pool.checkedin ?? 0), checkedout: Number(pool.checkedout ?? 0) },
        recommendations: recsRaw.map((r) => ({
          severity: String(r.severity ?? "info"),
          title: String(r.title ?? ""),
          detail: String(r.detail ?? r.message ?? ""),
        })),
        optimize_actions: actionsRaw.length ? actionsRaw : ["gc_collect", "dispose_db_pool", "clear_idle_tool_locks", "all"],
        celery: { worker_count: Number(celery.worker_count ?? celery.workerCount ?? 0) },
      } as ServerOverview;
    },
    {} as any,
  );

  const d = server || demoServer;

  const rss = d.processes.reduce((s, p) => s + p.rss_mb, 0);

  const runAction = async (action: string) => {
    setOptimizing(action);
    try {
      await api.post("/admin/server/optimize", { actions: [action] });
      toast("success", `Action ${action} dispatched`);
      refresh();
    } catch (err) {
      toast("error", "Action failed");
    } finally {
      setOptimizing(null);
    }
  };

  return (
    <div>
      <PageHeader title="Server Ops" description="Manage the platform runtime" actions={<button onClick={refresh} className="btn-ghost text-sm px-3 py-1.5"><RefreshCw size={14} /></button>} />
      {loading ? <TableSkeleton rows={3} /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <StatCard label="Health" value={<span className={cx(d.health === "healthy" ? "text-emerald-400" : d.health === "degraded" ? "text-amber-400" : "text-severity-critical")}>{d.health}</span>} icon={<Activity size={18} />} />
            <StatCard label="Memory" value={`${rss} MB`} icon={<Cpu size={18} />} />
            <StatCard label="DB Pool" value={`${d.database_pool.checkedout}/${d.database_pool.size}`} icon={<Database size={18} />} />
            <StatCard label="CPU Cores" value={String(d.resources.cpu_count_logical)} icon={<Server size={18} />} />
          </div>
          <Card>
            <CardHeader title="Actions" subtitle="GC, dispose, clear idle locks" />
            <div className="flex flex-wrap gap-2">
              {d.optimize_actions.map(a => (
                <button key={a} onClick={() => runAction(a)} disabled={optimizing === a} className="btn-secondary text-xs px-3 py-1.5">{optimizing === a ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} {a.replace(/_/g, " ")}</button>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
