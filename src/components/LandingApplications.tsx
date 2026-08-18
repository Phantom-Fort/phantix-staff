import React, { useCallback, useEffect, useState } from "react";
import { Inbox, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardHeader, StatusBadge, Spinner, EmptyState } from "@/components/ui";
import { useStore } from "@/lib/store";
import { timeAgo, cx } from "@/lib/utils";
import {
  SANDBOX_APPLY_API,
  SANDBOX_STAFF_KEY_CONFIGURED,
  listLandingApplications,
  patchLandingApplication,
  deleteLandingApplication,
  type LandingApplication,
  type ApplyStats,
} from "@/lib/sandboxApplyAdmin";

const STATUSES = ["pending", "approved", "rejected", "waitlist"] as const;

export default function LandingApplications() {
  const { toast } = useStore();
  const [items, setItems] = useState<LandingApplication[]>([]);
  const [stats, setStats] = useState<ApplyStats | null>(null);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!SANDBOX_STAFF_KEY_CONFIGURED) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await listLandingApplications(filter || undefined);
      setItems(data.items);
      setStats(data.stats);
    } catch (e) {
      toast("error", "Landing applications", e instanceof Error ? e.message : "");
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (id: string, status: string) => {
    setBusyId(id);
    try {
      const res = await patchLandingApplication(id, { status });
      setItems((list) => list.map((a) => (a.id === id ? res.application : a)));
      setStats(res.stats);
      toast("success", "Updated", status);
    } catch (e) {
      toast("error", "Update failed", e instanceof Error ? e.message : "");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this application?")) return;
    setBusyId(id);
    try {
      await deleteLandingApplication(id);
      setItems((list) => list.filter((a) => a.id !== id));
      toast("success", "Deleted");
      void load();
    } catch (e) {
      toast("error", "Delete failed", e instanceof Error ? e.message : "");
    } finally {
      setBusyId(null);
    }
  };

  if (!SANDBOX_STAFF_KEY_CONFIGURED) {
    return (
      <Card className="mb-5">
        <CardHeader title="Landing applications" subtitle="From phantix.site apply form" />
        <p className="text-xs leading-5 text-slate-500">
          Set <span className="font-mono text-slate-300">SANDBOX_APPLY_API</span> and{" "}
          <span className="font-mono text-slate-300">SANDBOX_STAFF_KEY</span> in{" "}
          <span className="font-mono text-slate-300">src/lib/config.ts</span>. API:{" "}
          <span className="font-mono">{SANDBOX_APPLY_API || "(unset)"}</span>
        </p>
      </Card>
    );
  }

  return (
    <Card className="mb-5 !p-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-phantix-700/40 px-5 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Landing applications</p>
          <p className="text-xs text-slate-500">
            {stats
              ? `${stats.enrolled}/${stats.max} enrolled · ${stats.seatsUsed} seats held · ${stats.pending} pending`
              : "Apply form queue"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-phantix-700/50 bg-phantix-950/70 px-2 py-1 text-xs text-slate-300"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button type="button" className="btn-ghost !text-xs" onClick={() => void load()}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : items.length === 0 ? (
        <div className="p-6">
          <EmptyState icon={<Inbox size={24} />} title="No applications" body="Landing form submissions appear here." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-phantix-800/50 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2">Organization</th>
                <th className="px-4 py-2">Contact</th>
                <th className="px-4 py-2">Use case</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} className="border-b border-phantix-900/60 hover:bg-phantix-900/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-100">{a.organization_name}</p>
                    <p className="text-[11px] text-slate-500">
                      {a.industry || "—"} · {a.country || "—"} · {a.website || "no site"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    <p>{a.contact_name}</p>
                    <p className="font-mono text-[11px]">{a.contact_email}</p>
                  </td>
                  <td className="max-w-[220px] px-4 py-3 text-xs text-slate-400">
                    <p className="line-clamp-2">{a.use_case}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{timeAgo(a.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select
                        disabled={busyId === a.id}
                        className="rounded-lg border border-phantix-700/50 bg-phantix-950/70 px-2 py-1 text-xs text-slate-300"
                        value={a.status}
                        onChange={(e) => void setStatus(a.id, e.target.value)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busyId === a.id}
                        className={cx("rounded-lg border border-phantix-700/40 p-1.5 text-slate-500 hover:text-severity-critical")}
                        onClick={() => void remove(a.id)}
                        title="Delete"
                      >
                        <Trash2 size={12} />
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
  );
}
