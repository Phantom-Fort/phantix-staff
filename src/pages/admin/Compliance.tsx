import React, { useCallback, useEffect, useRef, useState } from "react";
import { FileCheck, RefreshCw, FileUp, ListChecks, Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, TableSkeleton, EmptyState, Modal, Tabs } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { api, DEMO_MODE } from "@/lib/api";

interface ComplianceFramework {
  id: string;
  name: string;
  version: string;
  description: string;
  control_count: number;
  category: string;
  is_active: boolean;
}

interface GrcQuestion {
  id: number;
  question_key: string;
  prompt: string;
  help_text?: string | null;
  category?: string | null;
  risk?: string | null;
  answer_type: string;
  framework_ids: string[];
  sort_order: number;
  is_active: boolean;
  is_expert_managed: boolean;
  updated_by?: string | null;
  expert_notes?: string | null;
}

const demoFrameworks: ComplianceFramework[] = [
  { id: "iso27001", name: "ISO 27001", version: "2022", description: "Information security management standard", control_count: 93, category: "international", is_active: true },
  { id: "ndpr", name: "NDPR", version: "2019", description: "Nigeria Data Protection Regulation", control_count: 42, category: "national", is_active: true },
  { id: "pci_dss", name: "PCI DSS", version: "4.0", description: "Payment Card Industry Data Security Standard", control_count: 312, category: "industry", is_active: true },
  { id: "soc2", name: "SOC 2", version: "2023", description: "Service Organization Controls", control_count: 61, category: "international", is_active: true },
  { id: "gdpr", name: "GDPR", version: "2018", description: "General Data Protection Regulation", control_count: 99, category: "international", is_active: false },
];

const emptyQuestion = {
  prompt: "",
  category: "",
  risk: "medium",
  answer_type: "yes_no_partial",
  help_text: "",
  expert_notes: "",
  is_active: true,
};

function categoryFor(fw: { jurisdiction_triggers?: unknown; framework_id?: string }): string {
  const t = fw.jurisdiction_triggers as Record<string, unknown> | undefined;
  if (t && typeof t === "object") {
    if (t.country) return "national";
    if (t.region) return "international";
    if (t.industry) return "industry";
  }
  return "—";
}

export default function ComplianceAdmin() {
  const { toast } = useStore();
  const [tab, setTab] = useState("frameworks");
  const [uploadBusy, setUploadBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const frameworks = useResource<ComplianceFramework[]>(
    async () => {
      if (DEMO_MODE) return demoFrameworks;
      const raw = await api.get<any>("/admin/compliance/frameworks");
      const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
      // API returns `framework_id`; the UI keys off `id`.
      return items.map((fw: any) => ({
        id: String(fw.framework_id ?? fw.id ?? ""),
        name: String(fw.name ?? fw.framework_id ?? ""),
        version: String(fw.version ?? ""),
        description: String(fw.description ?? ""),
        control_count: Number(fw.control_count ?? 0),
        category: categoryFor(fw),
        is_active: fw.is_active !== false,
      }));
    },
    [],
  );

  const data = DEMO_MODE ? demoFrameworks : (frameworks.data ?? []);

  const handleSeed = async () => {
    try {
      await api.post("/admin/compliance/seed", {});
      toast("success", "Seed complete", "Built-in frameworks + questionnaire reloaded");
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
      const st = (e as { status?: number })?.status;
      toast(
        "error",
        st === 502 || st === 503 ? "Storage unavailable" : "Upload failed",
        st === 502 || st === 503 ? "Storage unavailable — retry." : e instanceof Error ? e.message : "",
      );
    } finally {
      setUploadBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── Questionnaire (per framework) ─────────────────────────────────────────
  const [selectedFw, setSelectedFw] = useState("");
  const [questions, setQuestions] = useState<GrcQuestion[]>([]);
  const [qLoading, setQLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyQuestion });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selectedFw && data.length) setSelectedFw(data[0].id);
  }, [data, selectedFw]);

  const loadQuestions = useCallback(async (fw: string) => {
    if (!fw) return;
    setQLoading(true);
    try {
      if (DEMO_MODE) {
        setQuestions([]);
        return;
      }
      const raw = await api.get<any>(`/admin/compliance/frameworks/${fw}/questions`);
      setQuestions(Array.isArray(raw) ? raw : (raw?.items ?? []));
    } catch (e) {
      toast("error", "Could not load questions", e instanceof Error ? e.message : "");
      setQuestions([]);
    } finally {
      setQLoading(false);
    }
  }, [toast]);

  useEffect(() => { void loadQuestions(selectedFw); }, [selectedFw, loadQuestions]);

  const openNewQuestion = () => {
    setEditingId(null);
    setForm({ ...emptyQuestion });
    setEditorOpen(true);
  };

  const openEditQuestion = (q: GrcQuestion) => {
    setEditingId(q.id);
    setForm({
      prompt: q.prompt,
      category: q.category ?? "",
      risk: q.risk ?? "medium",
      answer_type: q.answer_type || "yes_no_partial",
      help_text: q.help_text ?? "",
      expert_notes: q.expert_notes ?? "",
      is_active: q.is_active,
    });
    setEditorOpen(true);
  };

  const saveQuestion = async () => {
    if (form.prompt.trim().length < 8) {
      toast("error", "Prompt too short", "At least 8 characters.");
      return;
    }
    if (!selectedFw) {
      toast("error", "Pick a framework first");
      return;
    }
    setBusy(true);
    try {
      if (editingId != null) {
        await api.patch(`/admin/compliance/questionnaire/questions/${editingId}`, {
          prompt: form.prompt,
          category: form.category || null,
          risk: form.risk || null,
          answer_type: form.answer_type,
          help_text: form.help_text || null,
          expert_notes: form.expert_notes || null,
          is_active: form.is_active,
          framework_ids: [selectedFw],
        });
        toast("success", "Question updated");
      } else {
        await api.post("/admin/compliance/questionnaire/questions", {
          prompt: form.prompt,
          category: form.category || null,
          risk: form.risk || null,
          answer_type: form.answer_type,
          help_text: form.help_text || null,
          expert_notes: form.expert_notes || null,
          is_active: form.is_active,
          framework_ids: [selectedFw],
        });
        toast("success", "Question created");
      }
      setEditorOpen(false);
      await loadQuestions(selectedFw);
    } catch (e) {
      toast("error", "Save failed", e instanceof Error ? e.message : "");
    } finally {
      setBusy(false);
    }
  };

  const deactivateQuestion = async (q: GrcQuestion) => {
    try {
      await api.delete(`/admin/compliance/questionnaire/questions/${q.id}`);
      toast("success", "Question deactivated", q.question_key);
      await loadQuestions(selectedFw);
    } catch (e) {
      toast("error", "Failed", e instanceof Error ? e.message : "");
    }
  };

  const rebuild = async () => {
    try {
      const res = await api.post<any>("/admin/compliance/questionnaire/rebuild", {});
      toast("success", "Rebuilt", `Merged questionnaire regenerated${res?.created != null ? ` (+${res.created})` : ""}`);
      await loadQuestions(selectedFw);
    } catch (e) {
      toast("error", "Rebuild failed", e instanceof Error ? e.message : "");
    }
  };

  return (
    <div>
      <PageHeader
        title="Compliance"
        description="Manage global compliance frameworks and the GRC questionnaire catalog"
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
          { id: "questionnaire", label: "Questionnaire", count: questions.length || undefined },
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
                    <th className="th w-40" />
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
                        <div className="inline-flex items-center gap-1">
                          <button className="btn-ghost text-xs px-2 py-1" onClick={() => { setSelectedFw(fw.id); setTab("questionnaire"); }}>
                            Questions
                          </button>
                          <button className="btn-ghost text-xs px-2 py-1" onClick={() => handleToggle(fw.id, fw.is_active)}>
                            {fw.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
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
          <CardHeader
            title="GRC questionnaire catalog"
            subtitle="Expert-curated questions per framework. Auto-generated questions are rebuilt from controls; expert edits are preserved."
            action={
              <div className="flex items-center gap-2">
                <select className="input w-auto py-1.5 text-sm" value={selectedFw} onChange={(e) => setSelectedFw(e.target.value)}>
                  {data.map((fw) => <option key={fw.id} value={fw.id}>{fw.name}</option>)}
                </select>
                <button className="btn-ghost text-sm px-3 py-1.5" onClick={() => void rebuild()}>
                  <RefreshCw size={14} /> Rebuild
                </button>
                <button className="btn-primary text-sm px-3 py-1.5" onClick={openNewQuestion} disabled={!selectedFw}>
                  <Plus size={14} /> New question
                </button>
              </div>
            }
          />
          {qLoading ? (
            <div className="p-4"><TableSkeleton rows={6} cols={4} /></div>
          ) : questions.length === 0 ? (
            <EmptyState
              icon={<ListChecks size={24} />}
              title="No questions for this framework"
              body="Seed/rebuild from framework controls, or add an expert-curated question."
              action={<button onClick={openNewQuestion} className="btn-primary">New question</button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-phantix-700/40">
                    <th className="th">Question</th>
                    <th className="th">Category</th>
                    <th className="th">Risk</th>
                    <th className="th">Answer</th>
                    <th className="th">Source</th>
                    <th className="th">Status</th>
                    <th className="th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => (
                    <tr key={q.id} className="border-b border-phantix-700/20 hover:bg-phantix-800/40 transition-colors">
                      <td className="td max-w-[420px]">
                        <p className="text-sm text-slate-200">{q.prompt}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-500">{q.question_key}</p>
                      </td>
                      <td className="td text-xs text-slate-400">{q.category || "—"}</td>
                      <td className="td text-xs capitalize text-slate-300">{q.risk || "—"}</td>
                      <td className="td text-xs text-slate-400">{q.answer_type}</td>
                      <td className="td text-xs">
                        {q.is_expert_managed
                          ? <span className="chip border-gold-400/30 bg-gold-400/10 text-gold-300">expert</span>
                          : <span className="chip text-slate-500">auto</span>}
                      </td>
                      <td className="td">{q.is_active ? <StatusBadge status="active" /> : <StatusBadge status="inactive" />}</td>
                      <td className="td text-right">
                        <div className="inline-flex items-center gap-1">
                          <button className="btn-ghost !px-2 !py-1 !text-xs" onClick={() => openEditQuestion(q)}><Pencil size={12} /> Edit</button>
                          {q.is_active && (
                            <button className="btn-ghost !px-2 !py-1 !text-xs text-severity-critical" title="Deactivate" onClick={() => void deactivateQuestion(q)}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal open={editorOpen} onClose={() => !busy && setEditorOpen(false)} title={editingId ? "Edit question" : "New question"} wide>
        <div className="space-y-4">
          <div>
            <label className="label">Prompt</label>
            <textarea className="input !min-h-[90px]" value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} placeholder="Do you maintain an inventory of information assets?" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Category</label>
              <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="governance" />
            </div>
            <div>
              <label className="label">Risk</label>
              <select className="input" value={form.risk} onChange={(e) => setForm({ ...form, risk: e.target.value })}>
                {["low", "medium", "high", "critical"].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Answer type</label>
              <select className="input" value={form.answer_type} onChange={(e) => setForm({ ...form, answer_type: e.target.value })}>
                <option value="yes_no_partial">yes / no / partial</option>
                <option value="yes_no">yes / no</option>
                <option value="free_text">free text</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Help text (optional)</label>
            <textarea className="input !min-h-[60px]" value={form.help_text} onChange={(e) => setForm({ ...form, help_text: e.target.value })} />
          </div>
          <div>
            <label className="label">Expert notes (internal, optional)</label>
            <textarea className="input !min-h-[50px]" value={form.expert_notes} onChange={(e) => setForm({ ...form, expert_notes: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded accent-gold-400" />
            Active
          </label>
          <div className="flex justify-end gap-3">
            <button className="btn-secondary" disabled={busy} onClick={() => setEditorOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={busy} onClick={() => void saveQuestion()}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <FileCheck size={14} />} {editingId ? "Save changes" : "Create question"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
