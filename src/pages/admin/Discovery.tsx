import React, { useState } from "react";
import { Search, Settings, Terminal, RefreshCw, Eye, Play, Copy, AlertTriangle } from "lucide-react";
import { PageHeader, Card, CardHeader, TableSkeleton, EmptyState, Modal } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { api, DEMO_MODE } from "@/lib/api";
import { cx } from "@/lib/utils";
import type { DiscoverySettings } from "@/lib/types";

const demoSettings: DiscoverySettings = {
  nmap_binary_path: "/usr/bin/nmap",
  admin_flags: ["-sV", "-sC", "-O", "--max-retries=2"],
  default_flags: ["-sV", "-T4"],
  max_concurrent_jobs: 10,
};

function PreviewModal({ onClose }: { onClose: () => void }) {
  const { toast } = useStore();
  const [flags, setFlags] = useState("-sV -sC -O -T4");
  const [target, setTarget] = useState("example.com");
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePreview = async () => {
    setLoading(true);
    try {
      const res = await api.post<{ command: string }>("/admin/discovery/nmap/preview", {
        target, flags: flags.split(" ").filter(Boolean),
      });
      setPreview(res.command);
    } catch (e) {
      toast("error", "Preview failed", e instanceof Error ? e.message : "");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Target</label>
        <input className="input font-mono" placeholder="example.com or 192.168.1.0/24" value={target} onChange={(e) => setTarget(e.target.value)} />
      </div>
      <div>
        <label className="label">Flags</label>
        <input className="input font-mono" placeholder="-sV -sC -O" value={flags} onChange={(e) => setFlags(e.target.value)} />
      </div>
      <button onClick={handlePreview} disabled={loading} className="btn-secondary w-full">
        <Eye size={14} /> Preview Command
      </button>
      {preview && (
        <div className="rounded-lg bg-phantix-950/60 border border-phantix-700/40 p-3 font-mono text-xs text-slate-300 break-all relative group">
          {preview}
          <button
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity btn-ghost p-1"
            onClick={() => { navigator.clipboard?.writeText(preview); toast("success", "Copied"); }}
          >
            <Copy size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function DiscoveryAdmin() {
  const { toast } = useStore();
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flagsStr, setFlagsStr] = useState("");

  const { data: settings, loading, refresh } = useResource<DiscoverySettings>(
    async (signal) => {
      if (DEMO_MODE) return demoSettings;
      return api.get<DiscoverySettings>("/admin/discovery/settings");
    },
    {} as any,
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/admin/discovery/settings", {
        admin_flags: flagsStr.split(" ").filter(Boolean),
      });
      toast("success", "Settings saved", "Nmap flags updated");
      refresh();
    } catch (e) {
      toast("error", "Save failed", e instanceof Error ? e.message : "");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Discovery Settings"
        description="Configure Nmap binary path, default flags, and preview scan commands before deployment"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPreview(true)} className="btn-secondary text-sm px-3 py-1.5">
              <Terminal size={14} /> Preview Command
            </button>
            <button onClick={refresh} className="btn-ghost text-sm px-3 py-1.5">
              <RefreshCw size={14} />
            </button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Nmap Configuration" subtitle="Binary path and global flags" />
          {loading ? <TableSkeleton rows={3} /> : (
            <div className="space-y-3">
              <div>
                <label className="label">Binary Path</label>
                <input className="input font-mono text-sm bg-phantix-800/40" defaultValue={settings?.nmap_binary_path || "/usr/bin/nmap"} readOnly />
              </div>
              <div>
                <label className="label">Default Flags</label>
                <div className="text-sm font-mono text-slate-300 bg-phantix-950/60 border border-phantix-700/40 rounded-md p-2.5">
                  {settings?.default_flags?.join(" ") || "-sV -T4"}
                </div>
                <p className="text-xs text-slate-500 mt-1">Applied to all scans unless overridden</p>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Admin Flags"
            subtitle="Override flags for admin-initiated discovery (use with caution)"
            action={
              <span className="flex items-center gap-1 text-xs text-severity-high">
                <AlertTriangle size={12} /> Production impact
              </span>
            }
          />
          <div className="space-y-3">
            <div>
              <label className="label">Admin Override Flags</label>
              <input
                className="input font-mono text-sm"
                defaultValue={settings?.admin_flags?.join(" ") || ""}
                onChange={(e) => setFlagsStr(e.target.value)}
                placeholder="-sV -sC -O --max-retries=2"
              />
            </div>
            <div>
              <label className="label">Max Concurrent Jobs</label>
              <div className="text-sm font-mono text-white bg-phantix-950/60 border border-phantix-700/40 rounded-md p-2.5">
                {settings?.max_concurrent_jobs ?? "auto"}
              </div>
            </div>
            <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Settings size={14} />}
              Save Settings
            </button>
          </div>
        </Card>
      </div>

      <Modal open={showPreview} onClose={() => setShowPreview(false)} title="Preview Nmap Command">
        <PreviewModal onClose={() => setShowPreview(false)} />
      </Modal>
    </div>
  );
}
