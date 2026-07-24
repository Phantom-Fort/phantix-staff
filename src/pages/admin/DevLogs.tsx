import React, { useState } from "react";
import { RefreshCw, Clock, AlertTriangle, Info, AlertCircle, Bug, Plus } from "lucide-react";
import { PageHeader, Card, TableSkeleton, EmptyState, Modal } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { api, DEMO_MODE } from "@/lib/api";
import { useStore } from "@/lib/store";
import { timeAgo } from "@/lib/utils";

type LogEntry = { id: number; organization_id: number | null; issue_id: string | null; level: string; log_type: string; engine: string | null; category: string | null; message: string; created_at: string; source: string };

const demoLogs: LogEntry[] = [
  { id: 1, organization_id: 11, issue_id: "ISS-11-A223C840", level: "info", log_type: "app", engine: "scanner_engine", category: "scan", message: "Scan job #18 finished with status=completed", created_at: new Date(Date.now() - 3600000).toISOString(), source: "platform" },
  { id: 2, organization_id: 11, issue_id: "ISS-11-A6D1EE14", level: "warning", log_type: "app", engine: "scanner_engine", category: "scan", message: "Scan job #13 cancelled by operator", created_at: new Date(Date.now() - 7200000).toISOString(), source: "platform" },
  { id: 3, organization_id: 21, issue_id: "ISS-21-9C1BDC36", level: "error", log_type: "security", engine: "compliance_engine", category: "bootstrap", message: "Security DB bootstrap failed — driver version mismatch", created_at: new Date(Date.now() - 86400000).toISOString(), source: "platform" },
  { id: 4, organization_id: null, issue_id: null, level: "info", log_type: "http", engine: null, category: "access", message: "GET /api/v1/admin/dashboard/stats 200 42ms", created_at: new Date(Date.now() - 600000).toISOString(), source: "platform" },
];

export default function DevLogs() {
  const { toast } = useStore();
  const [showWriteLog, setShowWriteLog] = useState(false);
  const [logForm, setLogForm] = useState({ level: "info", log_type: "security", engine: "operations_engine", category: "support_note", message: "", organization_id: "" });
  const [logTypeFilter, setLogTypeFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");

  const logs = useResource<LogEntry[]>(
    async (signal) => {
      if (DEMO_MODE) return demoLogs;
      const raw = await api.get<any>("/admin/logs");
      const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
      return items as LogEntry[];
    },
    [],
  );

  const data = DEMO_MODE ? demoLogs : (logs.data?.length ? logs.data : []);

  const filtered = data.filter((log: any) => {
    if (logTypeFilter && log.log_type !== logTypeFilter) return false;
    if (levelFilter && log.level !== levelFilter) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Application Logs"
        description="Platform-wide diagnostics — scans, auth, HTTP, security events"
        actions={
          <>
            <button onClick={() => setShowWriteLog(true)} className="btn-secondary text-sm px-3 py-1.5"><Plus size={14} /> Write Note</button>
            <button onClick={() => logs.refresh()} className="btn-ghost text-sm px-3 py-1.5">
              <RefreshCw size={14} className={logs.loading ? "animate-spin" : ""} />
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select className="input w-auto py-1.5 text-xs" value={logTypeFilter} onChange={e => setLogTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {["app","auth","http","access","audit","bus","ai","security","system","scan","alert","report"].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input w-auto py-1.5 text-xs" value={levelFilter} onChange={e => setLevelFilter(e.target.value)}>
          <option value="">All Levels</option>
          {["debug","info","warning","error","critical"].map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <Card>
        {logs.loading ? (
          <div className="p-4"><TableSkeleton rows={6} /></div>
        ) : data.length === 0 ? (
          <EmptyState icon={<Bug size={24} />} title="No logs" body="No diagnostic entries yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-phantix-700/40">
                  <th className="th w-16">Level</th>
                  <th className="th">Message</th>
                  <th className="th">Type / Engine</th>
                  <th className="th">Org</th>
                  <th className="th w-32">Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => {
                  const levelColor = log.level === "error" ? "text-severity-critical bg-severity-critical/10 border-severity-critical/30"
                    : log.level === "warning" ? "text-severity-medium bg-severity-medium/10 border-severity-medium/30"
                    : "text-phantix-300 bg-phantix-500/10 border-phantix-500/20";
                  const LevelIcon = log.level === "error" ? AlertCircle : log.level === "warning" ? AlertTriangle : Info;
                  return (
                    <tr key={log.id} className="border-b border-phantix-700/20 hover:bg-phantix-800/40">
                      <td className="td">
                        <span className={`chip text-[10px] capitalize ${levelColor}`}>
                          <LevelIcon size={10} /> {log.level}
                        </span>
                      </td>
                      <td className="td">
                        <p className="text-sm text-slate-200">{log.message}</p>
                        {log.issue_id && <p className="text-[10px] font-mono text-slate-600 mt-0.5">{log.issue_id}</p>}
                      </td>
                      <td className="td">
                        <div className="space-y-0.5">
                          <span className="chip text-[10px] text-slate-400 bg-slate-400/10 border-slate-500/30">{log.log_type}</span>
                          {log.engine && <span className="text-[10px] text-slate-500 block">{log.engine}</span>}
                          {log.category && <span className="text-[10px] text-slate-600 block">{log.category}</span>}
                        </div>
                      </td>
                      <td className="td">
                        {log.organization_id ? (
                          <span className="text-xs font-mono text-slate-400">#{log.organization_id}</span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="td text-xs text-slate-500 whitespace-nowrap">{timeAgo(log.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showWriteLog} onClose={() => setShowWriteLog(false)} title="Write Diagnostic Entry">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Level</label><select className="input" value={logForm.level} onChange={e => setLogForm(l => ({...l, level: e.target.value}))}>{["debug","info","warning","error","critical"].map(lv => <option key={lv}>{lv}</option>)}</select></div>
            <div><label className="label">Log Type</label><select className="input" value={logForm.log_type} onChange={e => setLogForm(l => ({...l, log_type: e.target.value}))}>{["app","auth","security","system","scan","alert"].map(lt => <option key={lt}>{lt}</option>)}</select></div>
          </div>
          <div><label className="label">Organization ID (optional)</label><input className="input" type="number" value={logForm.organization_id} onChange={e => setLogForm(l => ({...l, organization_id: e.target.value}))} /></div>
          <div><label className="label">Message</label><textarea className="input resize-none" rows={3} value={logForm.message} onChange={e => setLogForm(l => ({...l, message: e.target.value}))} /></div>
          <button onClick={async () => {
            try {
              const body: any = { message: logForm.message, level: logForm.level, log_type: logForm.log_type, engine: logForm.engine, category: logForm.category };
              const orgId = logForm.organization_id ? `?organization_id=${logForm.organization_id}` : "";
              await api.post(`/admin/logs${orgId}`, body);
              toast("success", "Entry written"); setShowWriteLog(false); logs.refresh();
            } catch(e) { toast("error", e instanceof Error ? e.message : ""); }
          }} className="btn-primary w-full">Write Entry</button>
        </div>
      </Modal>
    </div>
  );
}
