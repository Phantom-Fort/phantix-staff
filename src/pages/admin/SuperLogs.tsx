import React, { useState, useEffect } from "react";
import { FileText, RefreshCw, Wifi, WifiOff, Search, Filter, ChevronDown, Bug, AlertTriangle, Info, AlertCircle, Clock, Activity } from "lucide-react";
import { PageHeader, Card, CardHeader, StatCard, AnimatedNumber, TableSkeleton, EmptyState, SeverityBadge } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { api, DEMO_MODE, tokens, API_BASE } from "@/lib/api";
import { timeAgo, cx } from "@/lib/utils";

type SuperLog = { id: number; organizationId: number | null; issueId: string | null; correlationId: string | null; level: string; logType: string; engine: string | null; category: string | null; message: string; createdAt: string; source: string };

const demoLogs: SuperLog[] = [
  { id: 1, organizationId: 11, issueId: "ISS-11-A223C840", correlationId: null, level: "error", logType: "scan", engine: "scanner_engine", category: "job", message: "Scan job #18 failed — tool timeout after 600s", createdAt: new Date(Date.now() - 600000).toISOString(), source: "platform" },
  { id: 2, organizationId: 24, issueId: "ISS-24-9C1BDC36", correlationId: "67cdffc7dbeb4ed19b7bf55b84fc51a0", level: "warning", logType: "scan", engine: "scanner_engine", category: "job", message: "Scan job #6 finished with warnings — 3 hosts unreachable", createdAt: new Date(Date.now() - 1200000).toISOString(), source: "platform" },
  { id: 3, organizationId: null, issueId: null, correlationId: null, level: "info", logType: "http", engine: null, category: "access", message: "GET /api/v1/admin/dashboard/stats 200 42ms (staff=admin@example.com)", createdAt: new Date(Date.now() - 300000).toISOString(), source: "platform" },
  { id: 4, organizationId: 11, issueId: "ISS-11-DD8145A4", correlationId: "973e0b40f4e94c52ba06963664d4e79b", level: "critical", logType: "security", engine: "compliance_engine", category: "bootstrap", message: "Security DB schema bootstrap failed — asyncpg driver error", createdAt: new Date(Date.now() - 3600000).toISOString(), source: "platform" },
  { id: 5, organizationId: 21, issueId: "ISS-21-CA48523F", correlationId: null, level: "info", logType: "app", engine: "ai_engine", category: "prompt", message: "AI finding_explanation v2 activated for org #21", createdAt: new Date(Date.now() - 7200000).toISOString(), source: "platform" },
];

const logTypes = ["app","auth","http","access","audit","bus","ai","security","system","dual_control","scan","alert","report"];
const levels = ["debug","info","warning","error","critical"];

export default function SuperLogs() {
  const { toast } = useStore();
  const [logTypeFilter, setLogTypeFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [orgFilter, setOrgFilter] = useState("");
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveEvents, setLiveEvents] = useState<SuperLog[]>([]);

  const logs = useResource<{ items: SuperLog[]; total: number }>(
    async (signal) => {
      if (DEMO_MODE) return { items: demoLogs, total: demoLogs.length };
      const params: Record<string, string | number | boolean> = { limit: 100 };
      if (logTypeFilter) params.log_type = logTypeFilter;
      if (levelFilter) params.level = levelFilter;
      if (orgFilter) params.organization_id = Number(orgFilter);
      return api.get<{ items: SuperLog[]; total: number }>("/admin/super/logs", { params });
    },
    [logTypeFilter, levelFilter, orgFilter],
  );

  const items = liveEvents.length > 0 ? [...liveEvents, ...(logs.data?.items || [])].slice(0, 100) : (logs.data?.items || []);

  // SSE stream for tail
  useEffect(() => {
    if (DEMO_MODE) { setLiveConnected(true); return; }
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      try {
        const url = `${API_BASE}/api/v1/admin/super/logs/stream?poll_seconds=5&level=${levelFilter || ""}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${tokens.staff}`, Accept: "text/event-stream" }, signal: controller.signal });
        if (!res.ok || !res.body) return;
        setLiveConnected(true);
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
            let dataStr = "";
            for (const line of lines) {
              if (line.startsWith("data:")) dataStr += line.slice(5).trim();
            }
            if (!dataStr) continue;
            try {
              const evt = JSON.parse(dataStr);
              if (evt.items) setLiveEvents((prev) => [...evt.items, ...prev].slice(0, 50));
            } catch { /* ignore */ }
          }
        }
      } catch { if (!cancelled) setLiveConnected(false); }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [levelFilter]);

  return (
    <div>
      <PageHeader
        title="Centralized Logs"
        description="All-tenant application logs with SSE live tail — scan jobs, auth, HTTP, security events"
        actions={
          <div className="flex items-center gap-2">
            <span className={cx("flex items-center gap-1.5 text-xs font-mono", liveConnected ? "text-emerald-400" : "text-slate-500")}>
              {liveConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {liveConnected ? "SSE Live" : "Polling"}
            </span>
            <button onClick={() => logs.refresh()} className="btn-ghost text-sm px-3 py-1.5">
              <RefreshCw size={14} className={logs.loading ? "animate-spin" : ""} />
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select className="input w-auto py-1.5 text-xs" value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
          <option value="">All Levels</option>
          {levels.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select className="input w-auto py-1.5 text-xs" value={logTypeFilter} onChange={e => setLogTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {logTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="input w-24 py-1.5 text-xs" placeholder="Org ID" value={orgFilter} onChange={e => setOrgFilter(e.target.value)} type="number" />
        {logs.data?.total !== undefined && (
          <span className="text-xs text-slate-500 ml-2">{logs.data.total} entries</span>
        )}
      </div>

      <Card>
        {logs.loading && !logs.data ? (
          <div className="p-4"><TableSkeleton rows={6} /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Bug size={24} />} title="No logs" body="No entries match current filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-phantix-700/40">
                  <th className="th w-16">Level</th>
                  <th className="th w-16">Type</th>
                  <th className="th">Message</th>
                  <th className="th w-16">Org</th>
                  <th className="th w-12">Engine</th>
                  <th className="th w-32">Time</th>
                </tr>
              </thead>
              <tbody>
                {items.map((log) => {
                  const levelColor = log.level === "error" || log.level === "critical" ? "text-severity-critical bg-severity-critical/10 border-severity-critical/30"
                    : log.level === "warning" ? "text-severity-medium bg-severity-medium/10 border-severity-medium/30"
                    : "text-phantix-300 bg-phantix-500/10 border-phantix-500/20";
                  const LevelIcon = log.level === "error" || log.level === "critical" ? AlertCircle : log.level === "warning" ? AlertTriangle : Info;
                  return (
                    <tr key={log.id} className={cx("border-b border-phantix-700/20 hover:bg-phantix-800/40", log.level === "critical" && "bg-severity-critical/5")}>
                      <td className="td">
                        <span className={cx("chip text-[10px] capitalize", levelColor)}>
                          <LevelIcon size={10} /> {log.level}
                        </span>
                      </td>
                      <td className="td"><span className="text-[10px] text-slate-500">{log.logType}</span></td>
                      <td className="td">
                        <p className="text-sm text-slate-200">{log.message}</p>
                        {log.issueId && <p className="text-[10px] font-mono text-slate-600 mt-0.5">{log.issueId}</p>}
                      </td>
                      <td className="td">
                        {log.organizationId ? <span className="text-xs font-mono text-slate-400">#{log.organizationId}</span> : <span className="text-xs text-slate-600">—</span>}
                      </td>
                      <td className="td"><span className="text-[10px] text-slate-500">{log.engine || "—"}</span></td>
                      <td className="td text-xs text-slate-500 whitespace-nowrap">{timeAgo(log.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
