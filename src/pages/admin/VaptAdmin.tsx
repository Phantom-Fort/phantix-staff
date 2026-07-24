import React, { useState } from "react";
import { Crosshair, Play, Pause, SkipForward, Clock, Plus, RefreshCw, Settings, Calendar, Activity } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, TableSkeleton, EmptyState, Modal, Tabs } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { timeAgo, cx, formatDateTime } from "@/lib/utils";

type VaptProcedure = { id: number; name: string; key: string; category: string; steps: number; active: boolean; created_at: string };
type CorrelationRule = { id: number; name: string; rule_key: string; engine: string; active: boolean; description: string };
type VaptSchedule = { id: number; name: string; procedure_key: string; cron: string; status: string; next_run: string; last_run: string | null };

const demoProcedures: VaptProcedure[] = [
  { id: 1, name: "Full Web App Penetration Test", key: "web_full", category: "web", steps: 8, active: true, created_at: "2026-06-01T00:00:00Z" },
  { id: 2, name: "External Network Scan", key: "ext_network", category: "network", steps: 5, active: true, created_at: "2026-06-15T00:00:00Z" },
  { id: 3, name: "API Security Assessment", key: "api_assess", category: "api", steps: 6, active: true, created_at: "2026-07-01T00:00:00Z" },
  { id: 4, name: "Mobile APK Analysis", key: "mobile_apk", category: "mobile", steps: 4, active: false, created_at: "2026-07-10T00:00:00Z" },
];

const demoRules: CorrelationRule[] = [
  { id: 1, name: "SQL Injection Correlation", rule_key: "sqli_corr", engine: "dedup", active: true, description: "Groups SQLi findings by endpoint and parameter" },
  { id: 2, name: "Duplicate Port Check", rule_key: "port_dup", engine: "dedup", active: true, description: "Deduplicates port scan findings across tools" },
  { id: 3, name: "CVE-to-Risk Mapping", rule_key: "cve_risk", engine: "risk", active: true, description: "Maps CVEs to risk scoring factors" },
];

const demoSchedules: VaptSchedule[] = [
  { id: 1, name: "Weekly External Scan", procedure_key: "ext_network", cron: "0 2 * * 0", status: "active", next_run: new Date(Date.now() + 172800000).toISOString(), last_run: new Date(Date.now() - 345600000).toISOString() },
  { id: 2, name: "Monthly Full Audit", procedure_key: "web_full", cron: "0 1 1 * *", status: "paused", next_run: new Date(Date.now() + 1209600000).toISOString(), last_run: new Date(Date.now() - 2592000000).toISOString() },
];

export default function VaptAdmin() {
  const { toast } = useStore();
  const [tab, setTab] = useState("procedures");
  const [showScheduleActions, setShowScheduleActions] = useState<number | null>(null);
  const [showNewProcedure, setShowNewProcedure] = useState(false);
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [newProc, setNewProc] = useState({ procedure_key: "", name: "", category: "web", steps: 5 });
  const [newSched, setNewSched] = useState({ name: "", procedure_key: "", cron: "0 2 * * 0" });

  const handleScheduleAction = async (id: number, action: string) => {
    try {
      await api.post(`/admin/vapt/schedules/${id}/${action}`, {});
      toast("success", `${action.replace("-", " ")}`, `Schedule #${id}`);
    } catch (e) {
      toast("error", "Failed", e instanceof Error ? e.message : "");
    }
  };

  return (
    <div>
      <PageHeader
        title="VAPT Administration"
        description="Manage platform-wide VAPT procedures, correlation rules, and cross-tenant scheduling"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNewProcedure(true)} className="btn-secondary text-sm px-3 py-1.5"><Plus size={14} /> Procedure</button>
            <button onClick={() => setShowNewSchedule(true)} className="btn-secondary text-sm px-3 py-1.5"><Plus size={14} /> Schedule</button>
          </div>
        }
      />

      <Tabs
        tabs={[
          { id: "procedures", label: "Procedures", count: demoProcedures.length },
          { id: "rules", label: "Correlation Rules", count: demoRules.length },
          { id: "schedules", label: "Schedules", count: demoSchedules.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "procedures" && (
        <Card>
          {demoProcedures.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-phantix-700/40">
                    <th className="th">Name</th>
                    <th className="th">Key</th>
                    <th className="th">Category</th>
                    <th className="th">Steps</th>
                    <th className="th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {demoProcedures.map((p) => (
                    <tr key={p.id} className="border-b border-phantix-700/20 hover:bg-phantix-800/40">
                      <td className="td"><span className="text-sm text-slate-100">{p.name}</span></td>
                      <td className="td"><span className="text-xs font-mono text-slate-400">{p.key}</span></td>
                      <td className="td"><span className="chip text-xs text-slate-400 bg-slate-400/10 border-slate-500/30">{p.category}</span></td>
                      <td className="td"><span className="text-sm font-mono text-slate-300">{p.steps}</span></td>
                      <td className="td">{p.active ? <StatusBadge status="active" /> : <StatusBadge status="closed" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<Crosshair size={24} />} title="No procedures" body="Create VAPT procedure definitions" />
          )}
        </Card>
      )}

      {tab === "rules" && (
        <Card>
          {demoRules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between border-b border-phantix-700/20 px-4 py-3 hover:bg-phantix-800/40">
              <div>
                <p className="text-sm font-medium text-slate-100">{rule.name}</p>
                <p className="text-xs text-slate-500">{rule.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="chip text-xs text-phantix-300 bg-phantix-500/10 border-phantix-500/20">{rule.engine}</span>
                <span className="text-xs font-mono text-slate-500">{rule.rule_key}</span>
                {rule.active ? <StatusBadge status="active" /> : <StatusBadge status="closed" />}
              </div>
            </div>
          ))}
        </Card>
      )}

      {tab === "schedules" && (
        <div className="space-y-3">
          {demoSchedules.map((s) => (
            <Card key={s.id} hover>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Calendar size={18} className="text-phantix-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-100">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.procedure_key} • {s.cron} • Next: {formatDateTime(s.next_run)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={s.status} />
                  {s.last_run && <span className="text-xs text-slate-500">Last: {timeAgo(s.last_run)}</span>}
                  <button onClick={() => handleScheduleAction(s.id, "run-now")} className="btn-ghost p-1.5" title="Run now"><Play size={14} /></button>
                  <button onClick={() => handleScheduleAction(s.id, "pause-until")} className="btn-ghost p-1.5" title="Pause"><Pause size={14} /></button>
                  <button onClick={() => handleScheduleAction(s.id, "skip-next")} className="btn-ghost p-1.5" title="Skip next"><SkipForward size={14} /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showNewProcedure} onClose={() => setShowNewProcedure(false)} title="Create VAPT Procedure">
        <div className="space-y-3">
          <div><label className="label">Procedure Key</label><input className="input" value={newProc.procedure_key} onChange={e => setNewProc(p => ({...p, procedure_key: e.target.value}))} placeholder="web_full" /></div>
          <div><label className="label">Name</label><input className="input" value={newProc.name} onChange={e => setNewProc(p => ({...p, name: e.target.value}))} /></div>
          <div><label className="label">Category</label><select className="input" value={newProc.category} onChange={e => setNewProc(p => ({...p, category: e.target.value}))}><option value="web">Web</option><option value="network">Network</option><option value="api">API</option><option value="mobile">Mobile</option></select></div>
          <button onClick={async () => { try { await api.post("/admin/vapt/procedures", newProc); toast("success", "Created"); setShowNewProcedure(false); } catch(e) { toast("error", e instanceof Error ? e.message : ""); } }} className="btn-primary w-full">Create Procedure</button>
        </div>
      </Modal>

      <Modal open={showNewSchedule} onClose={() => setShowNewSchedule(false)} title="Create VAPT Schedule">
        <div className="space-y-3">
          <div><label className="label">Name</label><input className="input" value={newSched.name} onChange={e => setNewSched(p => ({...p, name: e.target.value}))} /></div>
          <div><label className="label">Procedure Key</label><input className="input" value={newSched.procedure_key} onChange={e => setNewSched(p => ({...p, procedure_key: e.target.value}))} placeholder="ext_network" /></div>
          <div><label className="label">Cron Expression</label><input className="input font-mono" value={newSched.cron} onChange={e => setNewSched(p => ({...p, cron: e.target.value}))} placeholder="0 2 * * 0" /></div>
          <button onClick={async () => { try { await api.post("/admin/vapt/schedules", newSched); toast("success", "Created"); setShowNewSchedule(false); } catch(e) { toast("error", e instanceof Error ? e.message : ""); } }} className="btn-primary w-full">Create Schedule</button>
        </div>
      </Modal>
    </div>
  );
}
