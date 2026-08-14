import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { RedocStandalone } from "redoc";
import { api, DEMO_MODE } from "@/lib/api";

const DARK_THEME = {
  spacing: { unit: 4, sectionHorizontal: 40, sectionVertical: 24 },
  colors: {
    tonalOffset: 0.2,
    primary: {
      main: "#e8b54d",
      light: "#f4d488",
      dark: "#c9972f",
      contrastText: "#050b1d",
    },
    success: { main: "#34d399", light: "#6ee7b7", dark: "#059669", contrastText: "#050b1d" },
    warning: { main: "#fbbf24", light: "#fcd34d", dark: "#d97706", contrastText: "#050b1d" },
    error: { main: "#f87171", light: "#fca5a5", dark: "#dc2626", contrastText: "#ffffff" },
    gray: { 50: "#e2e8f0", 100: "#94a3b8" },
    border: { light: "#1e2a52", dark: "#0d1530" },
    text: { primary: "#e2e8f0", secondary: "#94a3b8" },
    responses: {
      success: { color: "#34d399", backgroundColor: "#0d1530", tabTextColor: "#34d399" },
      error: { color: "#f87171", backgroundColor: "#0d1530", tabTextColor: "#f87171" },
      redirect: { color: "#fbbf24", backgroundColor: "#0d1530", tabTextColor: "#fbbf24" },
      info: { color: "#60a5fa", backgroundColor: "#0d1530", tabTextColor: "#60a5fa" },
    },
    http: {
      get: "#34d399",
      post: "#e8b54d",
      put: "#60a5fa",
      options: "#a78bfa",
      patch: "#f472b6",
      delete: "#f87171",
      basic: "#a78bfa",
      link: "#60a5fa",
      head: "#34d399",
    },
    schema: {
      typeLabelColor: "#60a5fa",
      labelsTextColor: "#e2e8f0",
      requireLabelColor: "#f87171",
      labelsShelf: { backgroundColor: "transparent" },
    },
  },
  logo: { gutterBg: "#0d1530", maxHeight: "48px", gutterBorderColor: "#1e2a52" },
  rightPanel: {
    backgroundColor: "#0d1530",
    width: "44%",
    textColor: "#e2e8f0",
  },
  code: {
    backgroundColor: "#070c1c",
    textColor: "#e2e8f0",
    token: { keyword: "#e8b54d", string: "#86efac", number: "#a78bfa", boolean: "#fbbf24" },
  },
  typography: {
    fontSize: "13px",
    fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
    headings: { fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontWeight: "600" },
    code: { fontSize: "12px", fontFamily: "'JetBrains Mono', ui-monospace, monospace" },
    links: { color: "#e8b54d", visited: "#e8b54d", hover: "#f4d488", textDecoration: "none" },
  },
  sidebar: {
    backgroundColor: "#0a1128",
    textColor: "#e2e8f0",
    activeTextColor: "#e8b54d",
    groupItems: { activeTextColor: "#e8b54d", textColor: "#94a3b8" },
    width: "270px",
  },
  fab: { backgroundColor: "#1e2a52", color: "#e2e8f0" },
  buttons: {
    get: { color: "#050b1d", backgroundColor: "#34d399" },
    post: { color: "#050b1d", backgroundColor: "#e8b54d" },
    put: { color: "#050b1d", backgroundColor: "#60a5fa" },
    delete: { color: "#ffffff", backgroundColor: "#f87171" },
    options: { color: "#050b1d", backgroundColor: "#a78bfa" },
    patch: { color: "#050b1d", backgroundColor: "#f472b6" },
    basic: { color: "#050b1d", backgroundColor: "#a78bfa" },
    link: { color: "#050b1d", backgroundColor: "#60a5fa" },
    head: { color: "#050b1d", backgroundColor: "#34d399" },
  },
};

type Spec = Record<string, unknown>;

export default function ApiDocs() {
  const [spec, setSpec] = useState<Spec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      if (DEMO_MODE) {
        await new Promise((r) => setTimeout(r, 300));
        setSpec({
          openapi: "3.1.0",
          info: { title: "Phantix API (Demo)", version: "demo", description: "Run the backend with a real API key to view the live schema." },
          paths: {},
          components: { schemas: {} },
        });
      } else {
        const s = await api.get<Spec>("/staff/docs/openapi.json", {});
        setSpec(s);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the API schema");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const header = useMemo(
    () => (
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-phantix-800/80 text-gold-400">
            <BookOpen size={16} />
          </span>
          <div>
            <h1 className="font-display text-lg font-bold text-white">API Reference</h1>
            <p className="text-xs text-slate-400">Staff-only interactive documentation (ReDoc).</p>
          </div>
        </div>
        <button onClick={() => void load()} className="chip border-phantix-600/50 bg-phantix-800/50 text-slate-300 hover:text-gold-300">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh schema
        </button>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading],
  );

  return (
    <div>
      {header}
      {error ? (
        <div className="card flex items-start gap-3 p-5">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-severity-medium" />
          <div>
            <p className="text-sm font-medium text-slate-200">Could not load the API schema</p>
            <p className="mt-1 text-xs text-slate-400">{error}</p>
            <button onClick={() => void load()} className="btn-primary mt-3 !py-2 text-xs">Retry</button>
          </div>
        </div>
      ) : loading ? (
        <div className="card flex items-center gap-3 p-6">
          <Loader2 size={16} className="animate-spin text-gold-400" />
          <span className="text-sm text-slate-400">Loading schema…</span>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-phantix-700/40 bg-phantix-950/60">
          <RedocStandalone spec={spec as object} options={{ theme: DARK_THEME, hideDownloadButton: false }} />
        </div>
      )}
    </div>
  );
}
