import React, { useState } from "react";
import { Brain, Settings, Activity, Zap, RefreshCw, Play, DollarSign, Plus } from "lucide-react";
import { PageHeader, Card, CardHeader, StatCard, StatusBadge, TableSkeleton, EmptyState } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { api, DEMO_MODE } from "@/lib/api";

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

export default function AiAdmin() {
  const { toast } = useStore();
  const [activating, setActivating] = useState(false);
  const [showNewPrompt, setShowNewPrompt] = useState(false);
  const [newPrompt, setNewPrompt] = useState({ prompt_key: "", system_prompt: "", user_template: "", changelog: "", activate: true });

  const demoPrompts = [
    { id: 1, prompt_key: "finding_explanation", version: 2, is_active: true },
    { id: 2, prompt_key: "executive_summary", version: 1, is_active: true },
    { id: 3, prompt_key: "compliance_explain", version: 3, is_active: false },
  ];

  const handleActivatePrompt = async (key: string, version: number) => {
    try { await api.post(`/admin/ai/prompts/${key}/activate`, { version }); toast("success", `Prompt ${key} v${version} activated`); }
    catch (e) { toast("error", "Activate failed", e instanceof Error ? e.message : ""); }
  };

  const handleCreatePrompt = async () => {
    if (!newPrompt.prompt_key) { toast("error", "Missing key"); return; }
    try { await api.post("/admin/ai/prompts", newPrompt); toast("success", "Prompt created"); setShowNewPrompt(false); }
    catch (e) { toast("error", "Create failed", e instanceof Error ? e.message : ""); }
  };

  const ai = useResource<any>(
    async (signal) => {
      if (DEMO_MODE) return demoAiRaw;
      return api.get<any>("/admin/ai/settings");
    },
    [],
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
          <button onClick={() => ai.refresh()} className="btn-ghost text-sm px-3 py-1.5" disabled={ai.loading}>
            <RefreshCw size={14} className={ai.loading ? "animate-spin" : ""} />
          </button>
        }
      />

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
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
