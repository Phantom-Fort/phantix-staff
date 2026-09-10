import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, FileCode2, FileText, Loader2, Plus, RefreshCw, Search, Send } from "lucide-react";
import { PageHeader, Card, CardHeader, Modal, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { cx } from "@/lib/utils";

interface HandbookItem { id: string; title: string; path: string; href: string }
interface DocItem { id: string; title: string; path: string; category: string; href: string }
interface SeedPack {
  source: "seed"; engine: string; slug: string; path_hint: string; category: string; body_yaml: string;
}
interface ContentItem {
  id: number; type: string; title: string; slug: string; status: string; tags: string[];
  body_md?: string;
}

type Tab = "handbook" | "docs" | "yaml" | "research" | "blog";

export default function ContributeKnowledge() {
  const { toast, isAdmin } = useStore();
  const [tab, setTab] = useState<Tab>("handbook");
  const [handbook, setHandbook] = useState<HandbookItem[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [seeded, setSeeded] = useState<SeedPack[]>([]);
  const [docBody, setDocBody] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [active, setActive] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  const loadHandbook = useCallback(async () => {
    const res = await api.get<{ items: HandbookItem[] }>("/admin/contribute/handbook");
    setHandbook(res.items ?? []);
  }, []);

  const loadDocs = useCallback(async () => {
    const res = await api.get<{ items: DocItem[] }>("/admin/contribute/docs");
    setDocs(res.items ?? []);
  }, []);

  const loadSeeded = useCallback(async () => {
    const res = await api.get<{ items: SeedPack[] }>("/admin/contribute/yaml-packs/seeded");
    setSeeded(res.items ?? []);
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
      else if (tab === "docs") await loadDocs();
      else if (tab === "yaml") await loadSeeded();
      else await loadContent(tab);
    } catch (e) {
      toast("error", "Failed to load", e instanceof Error ? e.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [tab, loadHandbook, loadDocs, loadSeeded, loadContent, toast]);

  useEffect(() => { void load(); }, [load]);

  const categories = useMemo(
    () => Array.from(new Set((tab === "docs" ? docs : seeded).map((x: any) => x.category))).sort(),
    [tab, docs, seeded],
  );
  const norm = (s: string) => s.toLowerCase();
  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((d) => (!category || d.category === category) &&
      (!q || norm(d.title).includes(q) || norm(d.path).includes(q)));
  }, [docs, category, query]);
  const filteredSeeded = useMemo(() => {
    const q = query.trim().toLowerCase();
    return seeded.filter((s) => (!category || s.category === category) &&
      (!q || norm(s.slug).includes(q) || norm(s.path_hint).includes(q)));
  }, [seeded, category, query]);

  const openDoc = async (id: string, titleHint: string) => {
    try {
      const res = await api.get<{ body_md: string }>(`/admin/contribute/docs/${id}`);
      setDocTitle(titleHint);
      setDocBody(res.body_md);
    } catch (e) {
      toast("error", "Could not open document", e instanceof Error ? e.message : undefined);
    }
  };

  const openHandbook = async (id: string, titleHint: string) => {
    try {
      const res = await api.get<{ body_md: string; id: string }>(`/admin/contribute/handbook/${id}`);
      setDocTitle(titleHint);
      setDocBody(res.body_md);
    } catch (e) {
      toast("error", "Could not open document", e instanceof Error ? e.message : undefined);
    }
  };

  const openSeed = (s: SeedPack) => {
    setDocTitle(`${s.slug} (${s.category})`);
    setDocBody(s.body_yaml);
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
      const type = tab === "research" || tab === "blog" ? tab : "doc";
      const res = await api.post<{ id: number }>("/admin/contribute/content", {
        type,
        title: title.trim(),
        body_md: bodyMd,
      });
      toast("success", "Draft created");
      setShowCreate(false);
      setTitle("");
      setBodyMd("");
      if (tab === "research" || tab === "blog") {
        await loadContent(tab);
        if (res?.id) await openItem(res.id);
      }
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
      if (tab === "research" || tab === "blog") await loadContent(tab);
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
      if (tab === "research" || tab === "blog") await loadContent(tab);
    } catch (e) {
      toast("error", `${action} failed`, e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "handbook", label: "Handbook", count: handbook.length || undefined },
    { id: "docs", label: "Project docs", count: docs.length || undefined },
    { id: "yaml", label: "YAML packs", count: seeded.length || undefined },
    { id: "research", label: "Research" },
    { id: "blog", label: "Blogs" },
  ];

  const isReader = tab === "handbook" || tab === "docs" || tab === "yaml";

  const filterBar = (tab === "docs" || tab === "yaml") && (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          className="input !py-1.5 !pl-8 text-xs"
          placeholder={tab === "docs" ? "Search docs…" : "Search YAML…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <select className="input w-auto !py-1.5 text-xs" value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="">All sections</option>
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Knowledge"
        description="Handbook, project documentation, the engine YAML the platform runs, plus research and blogs."
        actions={
          <div className="flex items-center gap-2">
            {(tab === "research" || tab === "blog") && (
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
            onClick={() => { setTab(t.id); setCategory(""); setQuery(""); }}
            className={cx(
              "rounded-full border px-3 py-1.5 text-xs font-semibold",
              tab === t.id
                ? "border-gold-400/40 bg-gold-400/10 text-gold-300"
                : "border-phantix-700/40 text-slate-400 hover:text-slate-200",
            )}
          >
            {t.label}{t.count != null ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="h-5 w-5" /></div>
      ) : isReader ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader
              title={tab === "handbook" ? "Handbook" : tab === "docs" ? "Project documentation" : "Engine YAML packs"}
              subtitle={
                tab === "handbook" ? "Contributor onboarding maps"
                  : tab === "docs" ? `${filteredDocs.length} documents · docs/ + root guides`
                    : `${filteredSeeded.length} YAML files the engines load`
              }
            />
            {filterBar}
            <div className="max-h-[58vh] space-y-2 overflow-auto pr-1">
              {tab === "handbook" && handbook.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => void openHandbook(h.id, h.title)}
                  className="flex w-full items-start gap-3 rounded-md border border-phantix-700/40 bg-phantix-950/40 px-3 py-3 text-left hover:border-gold-400/30"
                >
                  <BookOpen size={15} className="mt-0.5 text-gold-400" />
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-200">{h.title}</span>
                    <span className="block truncate font-mono text-[10px] text-slate-500">{h.path}</span>
                  </span>
                </button>
              ))}
              {!handbook.length && tab === "handbook" && (
                <p className="text-xs text-slate-500">No handbook files found in this deployment.</p>
              )}

              {tab === "docs" && filteredDocs.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => void openDoc(d.id, d.title)}
                  className="flex w-full items-start gap-3 rounded-md border border-phantix-700/40 bg-phantix-950/40 px-3 py-2.5 text-left hover:border-gold-400/30"
                >
                  <FileText size={15} className="mt-0.5 text-phantix-300" />
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-200">{d.title}</span>
                    <span className="block truncate font-mono text-[10px] text-slate-500">{d.path}</span>
                  </span>
                  <span className="ml-auto chip shrink-0 text-[10px] border-phantix-600/50 text-slate-400">{d.category}</span>
                </button>
              ))}
              {tab === "docs" && !filteredDocs.length && <p className="text-xs text-slate-500">No documents match.</p>}

              {tab === "yaml" && filteredSeeded.map((s) => (
                <button
                  key={s.path_hint}
                  type="button"
                  onClick={() => openSeed(s)}
                  className="flex w-full items-center gap-3 rounded-md border border-phantix-700/40 bg-phantix-950/40 px-3 py-2.5 text-left hover:border-gold-400/30"
                >
                  <FileCode2 size={15} className="text-gold-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-slate-200">{s.slug}</span>
                    <span className="block truncate font-mono text-[10px] text-slate-500">{s.engine} · {s.path_hint}</span>
                  </span>
                  <span className="chip shrink-0 text-[10px] border-phantix-600/50 text-slate-400">{s.category}</span>
                </button>
              ))}
              {tab === "yaml" && !filteredSeeded.length && <p className="text-xs text-slate-500">No YAML packs match.</p>}
            </div>
            {tab === "yaml" && (
              <p className="mt-3 text-[11px] text-slate-500">
                Read-only view. To edit, fork a pack under <span className="font-mono">Contribute → Capabilities</span>.
              </p>
            )}
          </Card>

          <Card>
            <CardHeader title={docTitle || "Reader"} subtitle={tab === "yaml" ? "YAML" : "Markdown"} />
            {docBody == null ? (
              <p className="text-xs text-slate-500">
                Select a {tab === "yaml" ? "YAML pack" : "document"} to read it here.
              </p>
            ) : (
              <pre className="max-h-[64vh] overflow-auto whitespace-pre-wrap rounded-md border border-phantix-700/30 bg-phantix-950/60 p-3 text-[12px] leading-5 text-slate-300">
                {docBody}
              </pre>
            )}
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader
              title={tab === "research" ? "Research directions" : "Blogs"}
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
