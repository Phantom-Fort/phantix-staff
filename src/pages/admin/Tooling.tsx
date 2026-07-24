import React from "react";
import { Wrench, RefreshCw, Settings, DollarSign, Tag } from "lucide-react";
import { PageHeader, Card, StatusBadge, TableSkeleton, EmptyState } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { api, DEMO_MODE } from "@/lib/api";
import { formatNaira } from "@/lib/utils";

type AdminTool = { id: number; tool_key: string; name: string; description: string; category: string; pricing_model: string; monthly_price_ngn: number; is_active: boolean; is_featured: boolean; features: string[]; sort_order: number };

const demoTools: AdminTool[] = [
  { id: 1, tool_key: "config_inspector", name: "Config Inspector", description: "Inspect database security rules, roles, and engine configuration", category: "scanning", pricing_model: "free", monthly_price_ngn: 0, is_active: true, is_featured: true, features: ["metadata_scan", "role_audit", "rls_policy_view"], sort_order: 10 },
  { id: 2, tool_key: "vulnerability_scanner", name: "Vulnerability Scanner", description: "Scheduled and on-demand vulnerability scanning with findings export", category: "scanning", pricing_model: "paid", monthly_price_ngn: 2500, is_active: true, is_featured: true, features: ["scheduled_scans", "severity_scoring", "remediation_hints"], sort_order: 20 },
  { id: 3, tool_key: "compliance_workbench", name: "Compliance Workbench", description: "Control mapping, evidence collection, and audit readiness", category: "compliance", pricing_model: "paid", monthly_price_ngn: 3000, is_active: true, is_featured: true, features: ["frameworks", "evidence_locker", "gap_analysis"], sort_order: 30 },
  { id: 4, tool_key: "soc_alert_console", name: "SOC Alert Console", description: "Alert triage workspace for SOC-as-a-Service and MSSP clients", category: "monitoring", pricing_model: "paid", monthly_price_ngn: 5000, is_active: false, is_featured: false, features: ["alert_queue", "sla_timer", "escalation"], sort_order: 40 },
];

export default function ToolingAdmin() {
  const { toast } = useStore();

  const tools = useResource<AdminTool[]>(
    async (signal) => {
      if (DEMO_MODE) return demoTools;
      const raw = await api.get<any>("/admin/tooling/tools");
      return (Array.isArray(raw) ? raw : (raw?.items ?? [])) as AdminTool[];
    },
    [],
  );

  const data = DEMO_MODE ? demoTools : (tools.data?.length ? tools.data : []);

  const handleSeed = async () => {
    try { await api.post("/admin/tooling/tools/seed", {}); toast("success", "Seeded"); tools.refresh(); }
    catch (e) { toast("error", "Seed failed", e instanceof Error ? e.message : ""); }
  };

  return (
    <div>
      <PageHeader
        title="Tooling Marketplace"
        description={`${data.length} tools in catalog — manage availability, pricing, and features`}
        actions={
          <button onClick={handleSeed} className="btn-ghost text-sm px-3 py-1.5">
            <RefreshCw size={14} /> Seed
          </button>
        }
      />

      {tools.loading ? <TableSkeleton rows={4} /> : data.length === 0 ? (
        <EmptyState icon={<Wrench size={24} />} title="No tools" body="Seed the catalog to populate" action={<button onClick={handleSeed} className="btn-primary">Seed Defaults</button>} />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {data.sort((a, b) => a.sort_order - b.sort_order).map((t) => (
            <Card key={t.id} className={!t.is_active ? "opacity-60" : ""}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Wrench size={16} className={t.is_active ? "text-phantix-400" : "text-slate-600"} />
                  <h3 className="font-display text-sm font-semibold text-white">{t.name}</h3>
                  {t.is_featured && <span className="chip text-[10px] text-gold-400 bg-gold-400/10 border-gold-400/20">Featured</span>}
                </div>
                <StatusBadge status={t.is_active ? "active" : "closed"} />
              </div>
              <p className="text-xs text-slate-400 mb-3">{t.description}</p>
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <span className="chip text-[10px] text-phantix-300 bg-phantix-500/10 border-phantix-500/20">{t.category}</span>
                <span className="chip text-[10px] text-slate-400 bg-slate-400/10 border-slate-500/30 capitalize">{t.pricing_model}</span>
                {t.monthly_price_ngn > 0 && (
                  <span className="text-[10px] font-mono text-slate-400 flex items-center gap-0.5">
                    <DollarSign size={10} /> {formatNaira(t.monthly_price_ngn)}/mo
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {t.features.map((f) => (
                  <span key={f} className="text-[10px] text-slate-500 bg-phantix-800/60 rounded px-1.5 py-0.5">{f}</span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
