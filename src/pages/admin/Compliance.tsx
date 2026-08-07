import React, { useState, useRef } from "react";
import { FileCheck, Plus, RefreshCw, Upload, Search, Eye, FileUp, ListChecks, Loader2 } from "lucide-react";
import { PageHeader, Card, StatusBadge, TableSkeleton, EmptyState, Modal, Tabs } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { api, DEMO_MODE } from "@/lib/api";
import type { ComplianceFramework } from "@/lib/types";

const demoFrameworks: ComplianceFramework[] = [
  { id: "iso27001", name: "ISO 27001", version: "2022", description: "Information security management standard", control_count: 93, category: "international", is_active: true, recommended: true },
  { id: "ndpr", name: "NDPR", version: "2019", description: "Nigeria Data Protection Regulation", control_count: 42, category: "national", is_active: true, recommended: true },
  { id: "pci-dss", name: "PCI DSS", version: "4.0", description: "Payment Card Industry Data Security Standard", control_count: 312, category: "industry", is_active: true, recommended: false },
  { id: "soc2", name: "SOC 2", version: "2023", description: "Service Organization Controls", control_count: 61, category: "international", is_active: true, recommended: false },
  { id: "gdpr", name: "GDPR", version: "2018", description: "General Data Protection Regulation", control_count: 99, category: "international", is_active: false, recommended: false },
];

export default function ComplianceAdmin() {
  const { toast } = useStore();
  const [tab, setTab] = useState("frameworks");
  const [uploadBusy, setUploadBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const frameworks = useResource<ComplianceFramework[]>(
    async (signal) => {
      if (DEMO_MODE) return demoFrameworks;
      const raw = await api.get<any>("/admin/compliance/frameworks");
      const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
      return items as ComplianceFramework[];
    },
    [],
  );

  const data = DEMO_MODE ? demoFrameworks : (frameworks.data?.length ? frameworks.data : ([] as ComplianceFramework[]));

  const handleSeed = async () => {
    try {
      await api.post("/admin/compliance/seed", {});
      toast("success", "Seed complete", "Built-in frameworks reloaded");
      frameworks.refresh();
    } catch (e) {
      toast("error", "Seed failed", e instanceof Error ? e.message : "");
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await api.patch(`/admin/compliance/frameworks/${id}`, { is_active: !active });
      toast("success", `${active ? "Deactivated" : "Activated"}`, `Framework ${id}`);
      frameworks.refresh();
    } catch (e) {
      toast("error", "Failed", e instanceof Error ? e.message : "");
    }
  };

  const handleUpload = async (file: File) => {
    setUploadBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.postMultipart("/admin/compliance/frameworks/upload?force=true", formData);
      toast("success", "Uploaded", `Framework ${file.name} imported`);
      frameworks.refresh();
    } catch (e) {
      toast("error", "Upload failed", e instanceof Error ? e.message : "");
    } finally {
      setUploadBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <PageHeader
        title="Compliance"
        description="Manage global compliance frameworks and questionnaire catalog"
        actions={
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f); }}
            />
            <button onClick={() => fileRef.current?.click()} disabled={uploadBusy} className="btn-secondary text-sm px-3 py-1.5">
              {uploadBusy ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />} Upload Framework
            </button>
            <button onClick={handleSeed} className="btn-ghost text-sm px-3 py-1.5">
              <RefreshCw size={14} /> Reload Seeds
            </button>
          </div>
        }
      />

      <Tabs
        tabs={[
          { id: "frameworks", label: "Frameworks", count: data.length },
          { id: "questionnaire", label: "Questionnaire" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "frameworks" && (
      <Card>
        {frameworks.loading && !frameworks.data?.length ? (
          <div className="p-4"><TableSkeleton rows={5} cols={4} /></div>
        ) : data.length === 0 ? (
          <EmptyState icon={<FileCheck size={24} />} title="No frameworks" body="Seed or upload compliance frameworks" action={<button onClick={handleSeed} className="btn-primary">Load Seeds</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-phantix-700/40">
                  <th className="th">Framework</th>
                  <th className="th">Version</th>
                  <th className="th">Controls</th>
                  <th className="th">Category</th>
                  <th className="th">Status</th>
                  <th className="th w-12" />
                </tr>
              </thead>
              <tbody>
                {data.map((fw, i) => (
                  <tr key={fw.id || i} className="border-b border-phantix-700/20 hover:bg-phantix-800/40 transition-colors">
                    <td className="td">
                      <div>
                        <p className="text-sm font-medium text-slate-100">{fw.name}</p>
                        <p className="text-xs text-slate-500">{fw.description}</p>
                      </div>
                    </td>
                    <td className="td text-sm text-slate-300">{fw.version}</td>
                    <td className="td text-sm font-mono text-slate-300">{fw.control_count}</td>
                    <td className="td"><span className="chip text-xs text-slate-400 bg-slate-400/10 border-slate-500/30">{fw.category}</span></td>
                    <td className="td">{fw.is_active ? <StatusBadge status="active" /> : <StatusBadge status="closed" />}</td>
                    <td className="td">
                      <button
                        className="btn-ghost text-xs px-2 py-1"
                        onClick={() => handleToggle(fw.id, fw.is_active)}
                      >
                        {fw.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      )}

      {tab === "questionnaire" && (
        <Card>
          <div className="p-6 space-y-3">
            <div className="flex items-center gap-2">
              <ListChecks size={16} className="text-gold-400" />
              <p className="text-sm font-medium text-slate-200">GRC questionnaire catalog</p>
            </div>
            <p className="text-xs leading-5 text-slate-400">
              Manage expert-curated questionnaire questions and rebuild the auto-generated bank from framework controls.
              Question CRUD lives under <span className="font-mono">/admin/compliance/questionnaire/questions</span>.
            </p>
            <button
              className="btn-secondary text-sm"
              onClick={async () => {
                try {
                  await api.post("/admin/compliance/questionnaire/rebuild", {});
                  toast("success", "Rebuilt", "Merged questionnaire regenerated from controls");
                } catch (e) {
                  toast("error", "Rebuild failed", e instanceof Error ? e.message : "");
                }
              }}
            >
              <RefreshCw size={14} /> Rebuild Questionnaire
            </button>
            <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
              <span className="chip">POST /admin/compliance/questionnaire/questions</span>
              <span className="chip">PATCH /admin/compliance/questionnaire/questions/{`{id}`}</span>
              <span className="chip">DELETE /admin/compliance/questionnaire/questions/{`{id}`}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
