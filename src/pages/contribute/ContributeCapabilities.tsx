import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileCode2, Loader2, Plus, RefreshCw, Send, XCircle } from "lucide-react";
import { PageHeader, Card, CardHeader, Modal, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { cx } from "@/lib/utils";

interface Pack {
  id: number;
  engine: string;
  slug: string;
  path_hint: string | null;
  status: string;
  body_yaml?: string;
  validation_errors?: string | null;
  updated_at?: string | null;
}

const STARTER_YAML = `info:
  name: example_finding
  author: contributor
  severity: medium
  description: Replace with your check description.
scan:
  steps:
    - method: GET
      path: /
response:
  checks:
    - type: status
      value: 200
`;

export default function ContributeCapabilities() {
  const { toast, isAdmin } = useStore();
  const [items, setItems] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [active, setActive] = useState<Pack | null>(null);
  const [slug, setSlug] = useState("");
  const [bodyYaml, setBodyYaml] = useState(STARTER_YAML);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: Pack[] }>("/admin/contribute/yaml-packs");
      setItems(res.items ?? []);
    } catch (e) {
      toast("error", "Could not load YAML packs", e instanceof Error ? e.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const openPack = async (id: number) => {
    try {
      const pack = await api.get<Pack>(`/admin/contribute/yaml-packs/${id}`);
      setActive(pack);
      setBodyYaml(pack.body_yaml || "");
    } catch (e) {
      toast("error", "Could not open pack", e instanceof Error ? e.message : undefined);
    }
  };

  const create = async () => {
    if (!slug.trim()) return;
    setBusy(true);
    try {
      const res = await api.post<{ id: number }>("/admin/contribute/yaml-packs", {
        engine: "scanner",
        slug: slug.trim(),
        body_yaml: bodyYaml,
        path_hint: `scans/vulnerability/${slug.trim()}.yaml`,
      });
      toast("success", "YAML draft created");
      setShowCreate(false);
      setSlug("");
      setBodyYaml(STARTER_YAML);
      await load();
      if (res?.id) await openPack(res.id);
    } catch (e) {
      toast("error", "Create failed", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await api.patch(`/admin/contribute/yaml-packs/${active.id}`, { body_yaml: bodyYaml });
      toast("success", "Saved");
      await openPack(active.id);
      await load();
    } catch (e) {
      toast("error", "Save failed", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: "validate" | "submit" | "approve" | "reject") => {
    if (!active) return;
    setBusy(true);
    try {
      if (action === "validate" || action === "submit" || action === "approve") {
        await api.patch(`/admin/contribute/yaml-packs/${active.id}`, { body_yaml: bodyYaml }).catch(() => null);
      }
      const res = await api.post<Record<string, unknown>>(`/admin/contribute/yaml-packs/${active.id}/${action}`, {});
      if (action === "validate") {
        const ok = res?.ok === true;
        toast(ok ? "success" : "error", ok ? "YAML valid" : "Validation failed", Array.isArray(res?.errors) ? (res.errors as string[]).join("; ") : undefined);
      } else {
        toast("success", `Pack ${action}ed`);
      }
      await openPack(active.id);
      await load();
    } catch (e) {
      toast("error", `${action} failed`, e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Finding capabilities"
        description="Draft → validate → submit → approve. Approved packs land in the scanner YAML overlay without a redeploy."
        actions={
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-xs !py-2" onClick={() => setShowCreate(true)}>
              <Plus size={13} /> New YAML pack
            </button>
            <button type="button" className="btn-ghost text-xs !py-2" onClick={() => void load()}>
              <RefreshCw size={13} className={cx(loading && "animate-spin")} />
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Packs" subtitle={`${items.length} total`} />
          {loading ? (
            <div className="flex justify-center py-10"><Spinner className="h-5 w-5" /></div>
          ) : !items.length ? (
            <p className="text-xs text-slate-500">No capability packs yet.</p>
          ) : (
            <div className="max-h-[55vh] space-y-2 overflow-auto">
              {items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void openPack(p.id)}
                  className={cx(
                    "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left",
                    active?.id === p.id ? "border-gold-400/40 bg-gold-400/5" : "border-phantix-700/40 hover:border-gold-400/30",
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm text-slate-200">
                      <FileCode2 size={14} className="text-gold-400" /> {p.slug}
                    </span>
                    <span className="block text-[10px] text-slate-500">{p.engine}{p.path_hint ? ` · ${p.path_hint}` : ""}</span>
                  </span>
                  <span className="chip text-[10px] border-phantix-600/50 text-slate-400">{p.status}</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title={active ? active.slug : "Editor"} subtitle={active ? active.status : "Select a pack"} />
          {!active ? (
            <p className="text-xs text-slate-500">Open a pack to edit, validate, and submit.</p>
          ) : (
            <div className="space-y-3">
              <textarea
                className="input min-h-[280px] font-mono text-[11px] leading-5"
                value={bodyYaml}
                onChange={(e) => setBodyYaml(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary text-xs !py-1.5" disabled={busy} onClick={() => void save()}>Save</button>
                <button type="button" className="btn-secondary text-xs !py-1.5" disabled={busy} onClick={() => void act("validate")}>Validate</button>
                <button type="button" className="btn-primary text-xs !py-1.5" disabled={busy} onClick={() => void act("submit")}>
                  <Send size={12} /> Submit
                </button>
                {(isAdmin || active.status === "in_review") && (
                  <>
                    <button type="button" className="btn-primary text-xs !py-1.5" disabled={busy} onClick={() => void act("approve")}>
                      <CheckCircle2 size={12} /> Approve
                    </button>
                    <button type="button" className="btn-ghost text-xs !py-1.5 text-severity-critical" disabled={busy} onClick={() => void act("reject")}>
                      <XCircle size={12} /> Reject
                    </button>
                  </>
                )}
              </div>
              {active.validation_errors && (
                <p className="rounded-md border border-severity-critical/30 bg-severity-critical/10 p-2 text-[11px] text-severity-critical">
                  {active.validation_errors}
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New YAML capability pack">
        <div className="space-y-3">
          <input
            className="input font-mono text-sm"
            placeholder="slug (e.g. wordpress_xmlrpc_enabled)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <textarea
            className="input min-h-[200px] font-mono text-[11px] leading-5"
            value={bodyYaml}
            onChange={(e) => setBodyYaml(e.target.value)}
          />
          <button type="button" className="btn-primary w-full" disabled={busy || !slug.trim()} onClick={() => void create()}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Save draft
          </button>
        </div>
      </Modal>
    </div>
  );
}
