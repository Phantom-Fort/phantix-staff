import React, { useState } from "react";
import { Zap, RefreshCw, Eye, EyeOff, ChevronDown, ChevronUp, Layers, Navigation, BookOpen, Link2, Clock, Plus } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, TableSkeleton, EmptyState, Modal } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { api, DEMO_MODE } from "@/lib/api";
import { cx, timeAgo } from "@/lib/utils";

type ExpNavItem = { id: string; label: string; path: string; icon: string };
type ExpOnboarding = { id: string; title: string; description: string | null; action: string; params: Record<string, string> };
type ExpService = {
  service_key: string; label: string; description: string;
  modules: string[]; nav: ExpNavItem[]; dashboard_widgets: string[];
  onboarding: ExpOnboarding[]; requires_connections: string[];
  is_active: boolean; sort_order: number;
  created_at: string; updated_at: string; updated_by: string;
};

export default function ExperienceAdmin() {
  const { toast } = useStore();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const resource = useResource<ExpService[]>(
    async (signal) => {
      if (DEMO_MODE) return [];
      const raw = await api.get<any>("/admin/experience-services");
      return (Array.isArray(raw) ? raw : (raw?.items ?? [])) as ExpService[];
    },
    [],
  );

  const data = resource.data ?? [];
  const toggle = (key: string) => setExpanded((e) => ({ ...e, [key]: !e[key] }));

  const [showCreate, setShowCreate] = useState(false);
  const [newService, setNewService] = useState({ service_key: "", label: "", description: "", modules: "", nav_json: "", sort_order: 10 });

  const handleSeed = async () => {
    try {
      await api.post("/admin/experience-services/seed", {});
      toast("success", "Seeded", "Default services loaded");
      resource.refresh();
    } catch (e) {
      toast("error", "Seed failed", e instanceof Error ? e.message : "");
    }
  };

  return (
    <div>
      <PageHeader
        title="Experience Services"
        description="Platform product modules — each service defines nav, onboarding, widgets, and required connections"
        actions={
          <>
            <button onClick={() => setShowCreate(true)} className="btn-secondary text-sm px-3 py-1.5"><Plus size={14} /> New Service</button>
            <button onClick={handleSeed} className="btn-ghost text-sm px-3 py-1.5">
              <RefreshCw size={14} /> Seed Defaults
            </button>
          </>
        }
      />

      {resource.loading ? (
        <TableSkeleton rows={4} />
      ) : data.length === 0 ? (
        <EmptyState icon={<Zap size={24} />} title="No services" body="Seed defaults to populate the catalog" action={<button onClick={handleSeed} className="btn-primary">Seed Defaults</button>} />
      ) : (
        <div className="space-y-3">
          {data.sort((a, b) => a.sort_order - b.sort_order).map((svc) => {
            const open = !!expanded[svc.service_key];
            return (
              <Card key={svc.service_key} className="!p-0 overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => toggle(svc.service_key)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-phantix-800/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Zap size={18} className={svc.is_active ? "text-gold-400" : "text-slate-600"} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-100">{svc.label}</p>
                        {svc.is_active ? (
                          <span className="chip text-[10px] text-emerald-400 bg-emerald-400/10 border-emerald-400/30"><Eye size={10} /> Active</span>
                        ) : (
                          <span className="chip text-[10px] text-slate-400 bg-slate-400/10 border-slate-500/30"><EyeOff size={10} /> Inactive</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{svc.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-[10px] font-mono text-slate-500">{svc.service_key}</span>
                    <span className="text-[10px] text-slate-600">#{svc.sort_order}</span>
                    {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {open && (
                  <div className="border-t border-phantix-700/40 px-5 py-4 space-y-4 bg-phantix-900/30">
                    {/* Modules */}
                    {svc.modules.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5"><Layers size={11} /> Modules</p>
                        <div className="flex flex-wrap gap-1">
                          {svc.modules.map((m) => (
                            <span key={m} className="chip text-[10px] text-phantix-300 bg-phantix-500/10 border-phantix-500/20">{m}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Navigation */}
                    {svc.nav.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5"><Navigation size={11} /> Navigation</p>
                        <div className="space-y-1">
                          {svc.nav.map((n) => (
                            <div key={n.id} className="flex items-center gap-2 text-xs">
                              <span className="text-slate-600 w-16 font-mono">{n.icon}</span>
                              <span className="text-slate-300">{n.label}</span>
                              <span className="text-slate-600 font-mono">{n.path}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dashboard widgets */}
                    {svc.dashboard_widgets.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Widgets</p>
                        <div className="flex flex-wrap gap-1">
                          {svc.dashboard_widgets.map((w) => (
                            <span key={w} className="text-[10px] text-slate-400 bg-phantix-800/60 rounded px-1.5 py-0.5">{w}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Connections */}
                    {svc.requires_connections.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5"><Link2 size={11} /> Required Connections</p>
                        <div className="flex flex-wrap gap-1">
                          {svc.requires_connections.map((c) => (
                            <span key={c} className="chip text-[10px] text-severity-medium bg-severity-medium/10 border-severity-medium/20">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Onboarding */}
                    {svc.onboarding.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5"><BookOpen size={11} /> Onboarding Steps</p>
                        <div className="space-y-1.5">
                          {svc.onboarding.map((step, i) => (
                            <div key={step.id} className="flex items-start gap-2 text-xs">
                              <span className="text-slate-600 font-mono w-4 shrink-0 mt-0.5">{i + 1}.</span>
                              <div>
                                <p className="text-slate-300">{step.title}</p>
                                <p className="text-slate-500">
                                  {step.action}
                                  {step.params?.path ? ` → ${step.params.path}` : ''}
                                  {step.params?.connection_purpose ? ` (${step.params.connection_purpose})` : ''}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-3 text-[10px] text-slate-600 pt-1 border-t border-phantix-700/30">
                      <span className="flex items-center gap-1"><Clock size={10} /> Updated {timeAgo(svc.updated_at)}</span>
                      <span>by {svc.updated_by}</span>
                      <span>Created {new Date(svc.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Experience Service">
        <div className="space-y-3">
          <div><label className="label">Service Key</label><input className="input font-mono" value={newService.service_key} onChange={e => setNewService(s => ({...s, service_key: e.target.value}))} placeholder="penetration_testing" /></div>
          <div><label className="label">Label</label><input className="input" value={newService.label} onChange={e => setNewService(s => ({...s, label: e.target.value}))} /></div>
          <div><label className="label">Description</label><input className="input" value={newService.description} onChange={e => setNewService(s => ({...s, description: e.target.value}))} /></div>
          <div><label className="label">Modules (comma separated)</label><input className="input" value={newService.modules} onChange={e => setNewService(s => ({...s, modules: e.target.value}))} placeholder="assets,scans,findings" /></div>
          <div><label className="label">Navigation (JSON array)</label><textarea className="input resize-none font-mono text-xs" rows={3} value={newService.nav_json} onChange={e => setNewService(s => ({...s, nav_json: e.target.value}))} placeholder='[{"id":"assets","label":"Assets","path":"/assets","icon":"server"}]' /></div>
          <button onClick={async () => {
            try {
              const body: any = { service_key: newService.service_key, label: newService.label, description: newService.description, modules: newService.modules.split(",").map(s => s.trim()).filter(Boolean), sort_order: newService.sort_order, is_active: true };
              if (newService.nav_json) body.nav = JSON.parse(newService.nav_json);
              await api.post("/admin/experience-services", body);
              toast("success", "Service created"); setShowCreate(false); resource.refresh();
            } catch(e) { toast("error", e instanceof Error ? e.message : "Invalid JSON"); }
          }} className="btn-primary w-full">Create Service</button>
        </div>
      </Modal>
    </div>
  );
}
