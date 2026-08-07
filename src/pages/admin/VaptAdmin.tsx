import React, { useState } from "react";
import { Crosshair, Play, Pause, SkipForward, Plus, RefreshCw, Calendar, Trash2, Loader2 } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, TableSkeleton, EmptyState, Modal, Tabs } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { api, DEMO_MODE } from "@/lib/api";
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

const ruleToModel = (r: Record<string, unknown>): CorrelationRule => ({
  id: Number(r.id ?? r.rule_id ?? 0),
  name: String(r.display_name ?? r.name ?? r.rule_key ?? ""),
  rule_key: String(r.rule_key ?? ""),
  engine: String(r.engine ?? r.category ?? "rule"),
  active: r.is_active !== false,
  description: String(r.description ?? ""),
});

const scheduleToModel = (s: Record<string, unknown>): VaptSchedule => ({
  id: Number(s.id ?? s.schedule_id ?? 0),
  name: String(s.schedule_name ?? s.name ?? ""),
  procedure_key: String(s.procedure_key ?? ""),
  cron: String(s.cron_expression ?? s.cron ?? ""),
  status: String(s.status ?? "active"),
  next_run: (s.next_run_at as string) ?? (s.next_run as string) ?? null,
  last_run: (s.last_run_campaign_id as unknown as string) ?? null,
});

export default function VaptAdmin() {
  const { toast } = useStore();
  const [tab, setTab] = useState("procedures");
  const [showScheduleActions, setShowScheduleActions] = useState<number | null>(null);
  const [showNewProcedure, setShowNewProcedure] = useState(false);
  const [showNewSchedule, setShowNewSchedule] = useState(false);
  const [newProc, setNewProc] = useState({ procedure_key: "", name: "", category: "web", steps: 5 });
  const [newSched, setNewSched] = useState({ name: "", procedure_key: "", cron: "0 2 * * 0" });
  const [saving, setSaving] = useState(false);

  // Procedures: admin upsert API has no documented list; best-effort GET with graceful fallback.
  const procedures = useResource<VaptProcedure[]>(
    async (signal) => {
      if (DEMO_MODE) return demoProcedures;
      try {
        const res = await api.get<unknown>("/admin/vapt/procedures");
        const raw = Array.isArray(res) ? res : ((res as { items?: unknown[] })?.items ?? []);
        return (raw as Record<string, unknown>[]).map((p) => ({
          id: Number(p.id ?? p.procedure_id ?? 0),
          name: String(p.display_name ?? p.name ?? p.procedure_key ?? ""),
          key: String(p.procedure_key ?? ""),
          category: String(p.category ?? p.campaign_type ?? "other"),
          steps: Array.isArray(p.steps) ? (p.steps as unknown[]).length : Number(p.step_count ?? 0),
          active: p.is_active !== false,
          created_at: String(p.created_at ?? ""),
        }));
      } catch {
        return [];
      }
    },
    [] as VaptProcedure[],
  );

  const rules = useResource<CorrelationRule[]>(
    async (signal) => {
      if (DEMO_MODE) return demoRules;
      try {
        const res = await api.get<unknown>("/admin/vapt/correlation-rules/builtin");
        const raw = Array.isArray(res) ? res : ((res as { items?: unknown[] })?.items ?? []);
        return (raw as Record<string, unknown>[]).map(ruleToModel);
      } catch {
        return [];
      }
    },
    [] as CorrelationRule[],
  );

  const schedules = useResource<VaptSchedule[]>(
    async (signal) => {
      if (DEMO_MODE) return demoSchedules;
      try {
        const res = await api.get<unknown>("/admin/vapt/schedules");
        const raw = Array.isArray(res) ? res : ((res as { items?: unknown[] })?.items ?? []);
        return (raw as Record<string, unknown>[]).map(scheduleToModel);
      } catch {
        return [];
      }
    },
    [] as VaptSchedule[],
  );

  const handleScheduleAction = async (id: number, action: string) => {
    try {
      await api.post(`/admin/vapt/schedules/${id}/${action}`, {});
      toast("success", action.replace("-", " "), `Schedule #${id}`);
      schedules.refresh();
    } catch (e) {
      toast("error", "Failed", e instanceof Error ? e.message : "");
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    try {
      await api.delete(`/admin/vapt/schedules/${id}`);
      toast("success", "Deleted", `Schedule #${id}`);
      schedules.refresh();
    } catch (e) {
      toast("error", "Delete failed", e instanceof Error ? e.message : "");
    }
  };

  const createProcedure = async () => {
    if (!newProc.procedure_key.trim() || !newProc.name.trim()) {
      toast("warning", "Required fields", "Procedure key and name are required.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/admin/vapt/procedures", {
        procedure_key: newProc.procedure_key.trim(),
        display_name: newProc.name.trim(),
        category: newProc.category,
      });
      toast("success", "Created");
      setShowNewProcedure(false);
      setNewProc({ procedure_key: "", name: "", category: "web", steps: 5 });
      procedures.refresh();
    } catch (e) {
      toast("error", "Create failed", e instanceof Error ? e.message : "");
    } finally {
      setSaving(false);
    }
  };

  const createSchedule = async () => {
    if (!newSched.name.trim() || !newSched.procedure_key.trim()) {
      toast("warning", "Required fields", "Name and procedure key are required.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/admin/vapt/schedules", {
        schedule_name: newSched.name.trim(),
        procedure_key: newSched.procedure_key.trim(),
        cron_expression: newSched.cron,
        timezone: "UTC",
        is_active: true,
      });
      toast("success", "Created");
      setShowNewSchedule(false);
      setNewSched({ name: "", procedure_key: "", cron: "0 2 * * 0" });
      schedules.refresh();
    } catch (e) {
      toast("error", "Create failed", e instanceof Error ? e.message : "");
    } finally {
      setSaving(false);
    }
  };

  const procList = procedures.data;
  const ruleList = rules.data;
  const schedList = schedules.data;

  return (
    <div>
      <PageHeader
        title="VAPT Administration"
        description="Manage platform-wide VAPT procedures, correlation rules, and cross-tenant scheduling"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNewProcedure(true)} className="btn-secondary text-sm px-3 py-1.5"><Plus size={14} /> Procedure</button>
            <button onClick={() => setShowNewSchedule(true)} className="btn-secondary text-sm px-3 py-1.5"><Plus size={14} /> Schedule</button>
            <button onClick={() => { procedures.refresh(); rules.refresh(); schedules.refresh(); }} className="btn-ghost text-sm px-3 py-1.5"><RefreshCw size={14} /></button>
          </div>
        }
      />

      <Tabs
        tabs={[
          { id: "procedures", label: "Procedures", count: procList.length },
          { id: "rules", label: "Correlation Rules", count: ruleList.length },
          { id: "schedules", label: "Schedules", count: schedList.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "procedures" && (
        <Card>
          {procedures.loading && !procList.length ? <div className="p-4"><TableSkeleton rows={3} /></div>
          : procList.length > 0 ? (
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
                  {procList.map((p) => (
                    <tr key={p.id || p.key} className="border-b border-phantix-700/20 hover:bg-phantix-800/40">
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
          {rules.loading && !ruleList.length ? <div className="p-4"><TableSkeleton rows={3} /></div>
          : ruleList.length > 0 ? (
            ruleList.map((rule) => (
              <div key={rule.id || rule.rule_key} className="flex items-center justify-between border-b border-phantix-700/20 px-4 py-3 hover:bg-phantix-800/40">
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
            ))
          ) : (
            <EmptyState icon={<Crosshair size={24} />} title="No correlation rules" body="No built-in rules returned" />
          )}
        </Card>
      )}

      {tab === "schedules" && (
        <div className="space-y-3">
          {schedules.loading && !schedList.length ? <div className="p-4"><TableSkeleton rows={3} /></div>
          : schedList.length > 0 ? (
            schedList.map((s) => (
              <Card key={s.id} hover>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-100">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.procedure_key} • {s.cron} • Next: {s.next_run ? formatDateTime(s.next_run) : "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={s.status} />
                    {s.last_run && <span className="text-xs text-slate-500">Last: {timeAgo(s.last_run)}</span>}
                    <button onClick={() => handleScheduleAction(s.id, "run-now")} className="btn-ghost p-1.5" title="Run now"><Play size={14} /></button>
                    <button onClick={() => handleScheduleAction(s.id, "pause-until")} className="btn-ghost p-1.5" title="Pause"><Pause size={14} /></button>
                    <button onClick={() => handleScheduleAction(s.id, "skip-next")} className="btn-ghost p-1.5" title="Skip next"><SkipForward size={14} /></button>
                    <button onClick={() => handleDeleteSchedule(s.id)} className="btn-ghost p-1.5 text-severity-critical" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <EmptyState icon={<Calendar size={24} />} title="No schedules" body="Create cross-tenant VAPT schedules" />
          )}
        </div>
      )}

      <Modal open={showNewProcedure} onClose={() => setShowNewProcedure(false)} title="Create VAPT Procedure">
        <div className="space-y-3">
          <div><label className="label">Procedure Key</label><input className="input" value={newProc.procedure_key} onChange={e => setNewProc(p => ({...p, procedure_key: e.target.value}))} placeholder="web_full" /></div>
          <div><label className="label">Name</label><input className="input" value={newProc.name} onChange={e => setNewProc(p => ({...p, name: e.target.value}))} /></div>
          <div><label className="label">Category</label><select className="input" value={newProc.category} onChange={e => setNewProc(p => ({...p, category: e.target.value}))}><option value="web">Web</option><option value="network">Network</option><option value="api">API</option><option value="mobile">Mobile</option></select></div>
          <button onClick={createProcedure} disabled={saving} className="btn-primary w-full">{saving ? <Loader2 size={14} className="animate-spin inline" /> : null} Create Procedure</button>
        </div>
      </Modal>

      <Modal open={showNewSchedule} onClose={() => setShowNewSchedule(false)} title="Create VAPT Schedule">
        <div className="space-y-3">
          <div><label className="label">Name</label><input className="input" value={newSched.name} onChange={e => setNewSched(p => ({...p, name: e.target.value}))} /></div>
          <div><label className="label">Procedure Key</label><input className="input" value={newSched.procedure_key} onChange={e => setNewSched(p => ({...p, procedure_key: e.target.value}))} placeholder="ext_network" /></div>
          <div><label className="label">Cron Expression</label><input className="input font-mono" value={newSched.cron} onChange={e => setNewSched(p => ({...p, cron: e.target.value}))} placeholder="0 2 * * 0" /></div>
          <button onClick={createSchedule} disabled={saving} className="btn-primary w-full">{saving ? <Loader2 size={14} className="animate-spin inline" /> : null} Create Schedule</button>
        </div>
      </Modal>
    </div>
  );
}
