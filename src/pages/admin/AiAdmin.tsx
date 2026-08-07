import React, { useState } from "react";
import { Brain, Settings, Activity, Zap, RefreshCw, Play, DollarSign, Plus, FileText, ShieldAlert, GitBranch, Loader2 } from "lucide-react";
import { PageHeader, Card, CardHeader, StatCard, StatusBadge, TableSkeleton, EmptyState, Tabs, Modal } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { api, DEMO_MODE } from "@/lib/api";

type Prompt = { id: number; prompt_key: string; version: number; is_active: boolean; };
type DataScope = { prompt_key: string; allowed_evidence_keys: string[]; updated_at: string };

const demoAiRaw = {
  ai_enabled_platform: true,
  default_provider: "deepseek",
  providers_configured: {
    deepseek: true,
    qwen: false,
    kimi: true,
    openai: false,
  },
  deepseek_ready: true,
  ai_pentest_ready: true,
  agentrouter_ready: false,
  active_provider_hint: "deepseek",
  modes: ["economy", "balanced", "enterprise"],
  agents: ["finding_explanation", "executive_summary", "compliance_explain"],
};

const demoPrompts: Prompt[] = [
  { id: 1, prompt_key: "finding_explanation", version: 2, is_active: true },
  { id: 2, prompt_key: "executive_summary", version: 1, is_active: true },
  { id: 3, prompt_key: "compliance_explain", version: 3, is_active: false },
];
const demoSettings = { enabled: true, default_provider: "deepseek", mode: "balanced", modes: ["economy", "balanced", "enterprise"], prompts_count: 3, providers: [{ id: "deepseek", configured: true, active: true }] };

export default function AiAdmin() {
  const { toast } = useStore();
  const [tab, setTab] = useState("overview");
  const [activating, setActivating] = useState(false);
  const [showNewPrompt, setShowNewPrompt] = useState(false);
  const [newPrompt, setNewPrompt] = useState({ prompt_key: "", system_prompt: "", user_template: "", changelog: "", activate: true });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleActivatePrompt = async (key: string, version: number) => {
    try { await api.post(`/admin/ai/prompts/${key}/activate`, { version }); toast("success", `Prompt ${key} v${version} activated`); prompts.refresh(); }
    catch (e) { toast("error", "Activate failed", e instanceof Error ? e.message : ""); }
  };

  const handleCreatePrompt = async () => {
    if (!newPrompt.prompt_key) { toast("error", "Missing key"); return; }
    try { await api.post("/admin/ai/prompts", newPrompt); toast("success", "Prompt created"); setShowNewPrompt(false); setNewPrompt({ prompt_key: "", system_prompt: "", user_template: "", changelog: "", activate: true }); prompts.refresh(); }
    catch (e) { toast("error", "Create failed", e instanceof Error ? e.message : ""); }
  };

  const handleConsensusTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post<any>("/admin/ai/consensus/test", { evidence: { title: "Test finding", severity: "high", description: "Sample evidence for dry-run" } });
      setTestResult(typeof res === "string" ? res : JSON.stringify(res, null, 2));
      toast("success", "Consensus test complete", "Dry-run multi-model result returned");
    } catch (e) {
      toast("error", "Consensus test failed", e instanceof Error ? e.message : "");
    } finally {
      setTesting(false);
    }
  };

  const ai = useResource<any>(
    async (signal) => {
      if (DEMO_MODE) return demoAiRaw;
      return api.get<any>("/admin/ai/settings");
    },
    [],
  );

  const prompts = useResource<Prompt[]>(
    async (signal) => {
      if (DEMO_MODE) return demoPrompts;
      try {
        const res = await api.get<any>("/admin/ai/prompts");
        const raw = Array.isArray(res) ? res : (res?.items ?? []);
        return (raw as any[]).map((p) => ({ id: Number(p.id ?? 0), prompt_key: String(p.prompt_key ?? ""), version: Number(p.active_version ?? p.version ?? 0), is_active: Boolean(p.is_active ?? p.active) }));
      } catch { return []; }
    },
    [] as Prompt[],
  );

  const scopes = useResource<DataScope[]>(
    async (signal) => {
      if (DEMO_MODE) return [];
      try {
        const res = await api.get<any>("/admin/ai/data-scopes");
        const raw = Array.isArray(res) ? res : (res?.items ?? []);
        return (raw as any[]).map((d) => ({ prompt_key: String(d.prompt_key ?? ""), allowed_evidence_keys: Array.isArray(d.allowed_evidence_keys) ? d.allowed_evidence_keys : [], updated_at: String(d.updated_at ?? "") }));
      } catch { return []; }
    },
    [] as DataScope[],
  );

  const raw = ai.data;
  const data = raw
    ? {
        enabled: Boolean((raw as any).ai_enabled_platform ?? (raw as any).enabled ?? false),
        default_provider: String((raw as any).default_provider || (raw as any).active_provider_hint || ""),
        mode: Array.isArray((raw as any).modes) ? (raw as any).modes[0] : String((raw as any).mode || ""),
        modes: (raw as any).modes ?? [],
        prompts_count: Array.isArray((raw as any).agents) ? (raw as any).agents.length : Number((raw as any).prompts_count ?? 0),
        ai_pentest_ready: Boolean((raw as any).ai_pentest_ready ?? false),
        deepseek_ready: Boolean((raw as any).deepseek_ready ?? false),
        agentrouter_ready: Boolean((raw as any).agentrouter_ready ?? false),
        providers: (() => {
          const configured = (raw as any).providers_configured ?? (raw as any).providers ?? {};
          if (Array.isArray(configured)) return configured;
          if (!configured || typeof configured !== "object") return [];
          return Object.entries(configured as Record<string, boolean>).map(([id, conf]) => ({
            id,
            configured: Boolean(conf),
            active: id === ((raw as any).active_provider_hint || (raw as any).default_provider || "agentrouter"),
          }));
        })(),
      }
    : null;

  const handleActivate = async () => {
    setActivating(true);
    try {
      await api.post("/admin/ai/activate", {});
      toast("success", "AI activated", "Prompts seeded and providers enabled");
      ai.refresh();
    } catch (e) {
      toast("error", "Activation failed", e instanceof Error ? e.message : "");
    } finally {
      setActivating(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="AI Administration"
        description="Manage AI providers, prompts, data scopes, and track usage costs"
        actions={
          <button onClick={() => { ai.refresh(); prompts.refresh(); scopes.refresh(); }} className="btn-ghost text-sm px-3 py-1.5" disabled={ai.loading}>
            <RefreshCw size={14} className={ai.loading ? "animate-spin" : ""} />
          </button>
        }
      />

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "prompts", label: "Prompts", count: (prompts.data ?? []).length },
          { id: "scopes", label: "Data Scopes", count: (scopes.data ?? []).length },
          { id: "governance", label: "Governance" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
      <>
      {ai.loading ? (
        <TableSkeleton rows={3} />
      ) : !data ? (
        <EmptyState icon={<Brain size={24} />} title="AI settings unavailable" body="Could not load AI configuration. Check that the API server is running." />
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className={data.enabled ? "chip text-emerald-400 bg-emerald-400/10 border-emerald-400/30 text-sm" : "chip text-slate-400 bg-slate-400/10 border-slate-500/30 text-sm"}>
              <span className={`h-2 w-2 rounded-full ${data.enabled ? "bg-emerald-400 animate-pulse-soft" : "bg-slate-500"}`} />
              {data.enabled ? "Active" : "Inactive"}
            </div>
            <span className="text-sm text-slate-400">Default: <span className="text-white capitalize">{data.default_provider}</span></span>
            {data.ai_pentest_ready && <span className="chip text-xs text-emerald-400 bg-emerald-400/10 border-emerald-400/30">AI Pentest Ready</span>}
            <span className="text-sm text-slate-400">Mode: <span className="text-white capitalize">{data.mode}</span></span>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader title="Providers" subtitle="Configured AI model providers" />
              <div className="space-y-2">
                {data.providers.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg bg-phantix-800/40 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Brain size={15} className="text-phantix-400" />
                      <span className="text-sm text-slate-200 capitalize">{p.id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.configured ? <StatusBadge status="ready" /> : <span className="chip text-xs text-slate-400 bg-slate-400/10 border-slate-500/30">Not configured</span>}
                      {p.active && <span className="chip text-xs text-emerald-400 bg-emerald-400/10 border-emerald-400/30">Active</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Actions" />
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-phantix-800/40 px-3 py-2.5">
                  <span className="text-sm text-slate-300">AI Agents</span>
                  <span className="text-sm font-mono text-white">{data.prompts_count}</span>
                </div>
                {!data.enabled && (
                  <button onClick={handleActivate} disabled={activating} className="btn-primary w-full">
                    {activating ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                    Activate AI Engine
                  </button>
                )}
                <button onClick={handleConsensusTest} disabled={testing} className="btn-secondary w-full">
                  {testing ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
                  Dry-run consensus test
                </button>
                {testResult && (
                  <pre className="max-h-48 overflow-auto rounded-lg bg-phantix-950/70 border border-phantix-700/40 p-3 text-[10px] font-mono text-emerald-300 whitespace-pre-wrap">{testResult}</pre>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
      </>
      )}

      {tab === "prompts" && (
        <Card>
          <CardHeader title="Prompt versions" subtitle="Immutable, versioned system prompts" action={<button onClick={() => setShowNewPrompt(true)} className="btn-secondary text-sm px-3 py-1.5"><Plus size={14} /> New Prompt</button>} />
          {prompts.loading && !(prompts.data ?? []).length ? <div className="p-4"><TableSkeleton rows={3} /></div>
          : (prompts.data ?? []).length === 0 ? <EmptyState icon={<FileText size={24} />} title="No prompts" body="Create or activate prompts" />
          : (
            <div className="space-y-1.5">
              {(prompts.data ?? []).map((p) => (
                <div key={p.id || p.prompt_key} className="flex items-center justify-between rounded-lg bg-phantix-800/40 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-gold-400" />
                    <span className="text-sm font-mono text-slate-200">{p.prompt_key}</span>
                    <span className="chip text-[10px] text-slate-400 bg-slate-400/10 border-slate-500/30">v{p.version}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.is_active ? <StatusBadge status="active" /> : <span className="chip text-[10px] text-slate-500 bg-slate-400/10 border-slate-500/30">Inactive</span>}
                    {!p.is_active && <button onClick={() => handleActivatePrompt(p.prompt_key, p.version)} className="btn-ghost text-xs px-2 py-1">Activate</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "scopes" && (
        <Card>
          <CardHeader title="Data scopes" subtitle="Max evidence fields each prompt may see" />
          {(scopes.data ?? []).length === 0 ? (
            <EmptyState icon={<ShieldAlert size={24} />} title="No data scopes" body="Configure allowed evidence keys per prompt via PUT /admin/ai/data-scopes/{prompt_key}" />
          ) : (
            <div className="space-y-1.5">
              {(scopes.data ?? []).map((d) => (
                <div key={d.prompt_key} className="rounded-lg bg-phantix-800/40 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono text-slate-200">{d.prompt_key}</span>
                    <span className="text-[10px] text-slate-500">{d.updated_at ? new Date(d.updated_at).toLocaleDateString() : ""}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {d.allowed_evidence_keys.map((k) => <span key={k} className="chip text-[10px] text-phantix-300 bg-phantix-500/10 border-phantix-500/20">{k}</span>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "governance" && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Cost rollup" subtitle="GET /admin/ai/costs" />
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <DollarSign size={16} className="text-gold-400" />
              <span>Tracked via <span className="font-mono">GET /admin/ai/costs</span></span>
            </div>
          </Card>
          <Card>
            <CardHeader title="Audit trail" subtitle="GET /admin/ai/audit-logs" />
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <Activity size={16} className="text-gold-400" />
              <span>AI call audit available at <span className="font-mono">GET /admin/ai/audit-logs</span></span>
            </div>
          </Card>
        </div>
      )}

      <Modal open={showNewPrompt} onClose={() => setShowNewPrompt(false)} title="Create AI Prompt">
        <div className="space-y-3">
          <div><label className="label">Prompt Key</label><input className="input font-mono" value={newPrompt.prompt_key} onChange={e => setNewPrompt(p => ({...p, prompt_key: e.target.value}))} placeholder="finding_explanation" /></div>
          <div><label className="label">System Prompt</label><textarea className="input resize-none" rows={3} value={newPrompt.system_prompt} onChange={e => setNewPrompt(p => ({...p, system_prompt: e.target.value}))} /></div>
          <div><label className="label">User Template (optional)</label><textarea className="input resize-none" rows={2} value={newPrompt.user_template} onChange={e => setNewPrompt(p => ({...p, user_template: e.target.value}))} placeholder="{{finding}}" /></div>
          <div><label className="label">Changelog</label><input className="input" value={newPrompt.changelog} onChange={e => setNewPrompt(p => ({...p, changelog: e.target.value}))} /></div>
          <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={newPrompt.activate} onChange={e => setNewPrompt(p => ({...p, activate: e.target.checked}))} className="accent-gold-400" /> Activate as default version</label>
          <button onClick={handleCreatePrompt} className="btn-primary w-full">Create Prompt</button>
        </div>
      </Modal>
    </div>
  );
}
