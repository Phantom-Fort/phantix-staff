import React, { useCallback, useEffect, useState } from "react";
import { BookOpen, FileText, Loader2, Plus, RefreshCw, Send } from "lucide-react";
import { PageHeader, Card, CardHeader, Modal, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { cx } from "@/lib/utils";

interface HandbookItem { id: string; title: string; path: string; href: string }
interface ContentItem {
  id: number; type: string; title: string; slug: string; status: string; tags: string[];
  body_md?: string;
}

export default function ContributeKnowledge() {
  const { toast, isAdmin } = useStore();
  const [tab, setTab] = useState<"handbook" | "research" | "blog" | "doc">("handbook");
  const [handbook, setHandbook] = useState<HandbookItem[]>([]);
  const [docBody, setDocBody] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [active, setActive] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [busy, setBusy] = useState(false);

  const loadHandbook = useCallback(async () => {
    const res = await api.get<{ items: HandbookItem[] }>("/admin/contribute/handbook");
    setHandbook(res.items ?? []);
  }, []);

  const loadContent = useCallback(async (type: string) => {
    const res = await api.get<{ items: ContentItem[] }>(`/admin/contribute/content?type=${type}`);
    setItems(res.items ?? []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setDocBody(null);
    setActive(null);
    try {
      if (tab === "handbook") await loadHandbook();
      else await loadContent(tab);
    } catch (e) {
      toast("error", "Failed to load", e instanceof Error ? e.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [tab, loadHandbook, loadContent, toast]);

  useEffect(() => { void load(); }, [load]);

  const openDoc = async (id: string, titleHint: string) => {
    try {
      const res = await api.get<{ body_md: string; id: string }>(`/admin/contribute/handbook/${id}`);
      setDocTitle(titleHint);
      setDocBody(res.body_md);
    } catch (e) {
      toast("error", "Could not open document", e instanceof Error ? e.message : undefined);
    }
  };

  const openItem = async (id: number) => {
    try {
      const item = await api.get<ContentItem>(`/admin/contribute/content/${id}`);
      setActive(item);
      setBodyMd(item.body_md || "");
      setTitle(item.title);
    } catch (e) {
      toast("error", "Could not open item", e instanceof Error ? e.message : undefined);
    }
  };

  const createDraft = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await api.post<{ id: number }>("/admin/contribute/content", {
        type: tab === "handbook" ? "doc" : tab,
        title: title.trim(),
        body_md: bodyMd,
      });
      toast("success", "Draft created");
      setShowCreate(false);
      const t = tab === "handbook" ? "doc" : tab;
      if (tab !== "handbook") {
        await loadContent(t);
        if (res?.id) await openItem(res.id);
      }
      setTitle("");
      setBodyMd("");
    } catch (e) {
      toast("error", "Create failed", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const saveItem = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await api.patch(`/admin/contribute/content/${active.id}`, { title, body_md: bodyMd });
      toast("success", "Saved");
      await openItem(active.id);
      await loadContent(tab === "handbook" ? "doc" : tab);
    } catch (e) {
      toast("error", "Save failed", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: "submit" | "publish" | "archive") => {
    if (!active) return;
    setBusy(true);
    try {
      await api.patch(`/admin/contribute/content/${active.id}`, { title, body_md: bodyMd }).catch(() => null);
      await api.post(`/admin/contribute/content/${active.id}/${action}`, {});
      toast("success", `Content ${action}ed`);
      await openItem(active.id);
      await loadContent(tab === "handbook" ? "doc" : tab);
    } catch (e) {
      toast("error", `${action} failed`, e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "handbook", label: "Handbook" },
    { id: "research", label: "Research" },
    { id: "blog", label: "Blogs" },
    { id: "doc", label: "Docs" },
  ];

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Knowledge"
        description="Handbook, research directions, and blogs — draft, submit for review, publish."
        actions={
          <div className="flex items-center gap-2">
            {tab !== "handbook" && (
              <button type="button" className="btn-secondary text-xs !py-2" onClick={() => { setShowCreate(true); setTitle(""); setBodyMd(""); }}>
                <Plus size={13} /> New draft
              </button>
            )}
            <button type="button" onClick={() => void load()} className="btn-ghost text-xs !py-2">
              <RefreshCw size={13} className={cx(loading && "animate-spin")} />
            </button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cx(
              "rounded-full border px-3 py-1.5 text-xs font-semibold",
              tab === t.id
                ? "border-gold-400/40 bg-gold-400/10 text-gold-300"
                : "border-phantix-700/40 text-slate-400 hover:text-slate-200",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="h-5 w-5" /></div>
      ) : tab === "handbook" ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Handbook" subtitle="Onboarding maps for contributors" />
            <div className="space-y-2">
              {handbook.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => void openDoc(h.id, h.title)}
                  className="flex w-full items-start gap-3 rounded-md border border-phantix-700/40 bg-phantix-950/40 px-3 py-3 text-left hover:border-gold-400/30"
                >
                  <BookOpen size={15} className="mt-0.5 text-gold-400" />
                  <span>
                    <span className="block text-sm text-slate-200">{h.title}</span>
                    <span className="block font-mono text-[10px] text-slate-500">{h.path}</span>
                  </span>
                </button>
              ))}
              {!handbook.length && <p className="text-xs text-slate-500">No handbook files found in this deployment.</p>}
            </div>
          </Card>
          <Card>
            <CardHeader title={docTitle || "Reader"} subtitle="Markdown" />
            {docBody == null ? (
              <p className="text-xs text-slate-500">Select a handbook document to read it here.</p>
            ) : (
              <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border border-phantix-700/30 bg-phantix-950/60 p-3 text-[12px] leading-5 text-slate-300">
                {docBody}
              </pre>
            )}
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader
              title={tab === "research" ? "Research directions" : tab === "blog" ? "Blogs" : "Doc drafts"}
              subtitle={`${items.length} items`}
            />
            {!items.length ? (
              <p className="text-xs text-slate-500">No drafts yet.</p>
            ) : (
              <div className="space-y-2">
                {items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => void openItem(it.id)}
                    className={cx(
                      "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left",
                      active?.id === it.id ? "border-gold-400/40 bg-gold-400/5" : "border-phantix-700/40 hover:border-gold-400/30",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-200">{it.title}</p>
                      <p className="font-mono text-[10px] text-slate-500">{it.slug}</p>
                    </div>
                    <span className="chip text-[10px] border-phantix-600/50 text-slate-400">{it.status}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title={active ? active.title : "Editor"} subtitle={active?.status || "Select an item"} />
            {!active ? (
              <p className="text-xs text-slate-500">Select a draft to edit and submit.</p>
            ) : (
              <div className="space-y-3">
                <input className="input text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
                <textarea
                  className="input min-h-[220px] font-mono text-xs"
                  value={bodyMd}
                  onChange={(e) => setBodyMd(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary text-xs !py-1.5" disabled={busy} onClick={() => void saveItem()}>Save</button>
                  <button type="button" className="btn-primary text-xs !py-1.5" disabled={busy} onClick={() => void act("submit")}>
                    <Send size={12} /> Submit
                  </button>
                  {(isAdmin || active.status === "review") && (
                    <button type="button" className="btn-primary text-xs !py-1.5" disabled={busy} onClick={() => void act("publish")}>Publish</button>
                  )}
                  {isAdmin && (
                    <button type="button" className="btn-ghost text-xs !py-1.5" disabled={busy} onClick={() => void act("archive")}>Archive</button>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={`New ${tab} draft`}>
        <div className="space-y-3">
          <input className="input text-sm" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea
            className="input min-h-[160px] font-mono text-xs"
            placeholder="Markdown body"
            value={bodyMd}
            onChange={(e) => setBodyMd(e.target.value)}
          />
          <button type="button" className="btn-primary w-full" disabled={busy || !title.trim()} onClick={() => void createDraft()}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Create draft
          </button>
        </div>
      </Modal>
    </div>
  );
}
