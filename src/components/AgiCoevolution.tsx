import React, { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Cpu, Loader2, Star, Wrench, XCircle } from "lucide-react";
import { Card, CardHeader, StatusBadge } from "@/components/ui";
import { confirmAgiJob, loadAgiEngineCatalog, loadAgiEngineLearning, waiveAgiJobObjective } from "@/lib/agi";
import type { AgiEngineCapability, AgiEngineOp, AgiSessionJob, AgiSkillPlan, AgiToolInstallRequest, AgiToolPlan, AgiToolToProvision, EngineCallEvent } from "@/lib/types";
import { cx } from "@/lib/utils";
import { useStore } from "@/lib/store";

export function AgiSkillPlanBanner({ plan }: { plan: AgiSkillPlan | null }) {
  if (!plan) return null;
  const skills = plan.skills ?? [];
  return (
    <div className="border-b border-phantix-700/40 bg-phantix-950/80 px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
        <span className="font-semibold uppercase tracking-wider text-slate-400">Skills for this objective</span>
        {(plan.intents ?? []).map((i) => <span key={i} className="chip !px-1.5 !py-0 !text-[9px] text-gold-300">{i}</span>)}
        {plan.objective && <span className="truncate text-[10px] text-slate-500">{plan.objective}</span>}
      </div>
      {plan.stream_message && <p className="mt-1 text-[11px] leading-4 text-slate-400">{plan.stream_message}</p>}
      {skills.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {skills.map((s) => (
            <span key={s.skill_id} title={`${s.match_reason ?? ""} · eff ${s.efficiency ?? "-"} · obj ${s.objective_score ?? "-"} · ${(s.tools ?? []).join(", ")}`} className="chip !text-[9px]">
              {s.role === "primary" || s.rank === 1 ? <Star size={9} className="fill-gold-400 text-gold-400" /> : null}
              <span className={cx(s.role === "primary" && "text-gold-200")}>{s.skill_id}</span>
              {s.body_loaded ? <span className="text-emerald-400">· Full</span> : <span className="text-slate-500">· Card</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function AgiToolsToProvisionStrip({ toolPlan, onOpenApprovals }: { toolPlan: AgiToolPlan | null; onOpenApprovals?: () => void }) {
  const list: AgiToolToProvision[] = toolPlan?.to_provision ?? [];
  if (!toolPlan || list.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-severity-medium/25 bg-severity-medium/5 px-3 py-2">
      <Wrench size={12} className="text-severity-medium" />
      <span className="text-[11px] text-amber-200">Tools needed for matched skills:</span>
      {list.map((t) => (
        <span key={t.tool} className={cx("chip !text-[9px]", t.required ? "border-severity-medium/40 text-severity-medium" : "border-phantix-600/40 text-slate-400")}>
          {t.tool} <span className="opacity-70">({t.package})</span>{t.required ? " · required" : ""}
        </span>
      ))}
      {onOpenApprovals && (
        <button onClick={onOpenApprovals} className="ml-auto btn-secondary !px-2.5 !py-1 !text-[10px]">Review approvals</button>
      )}
    </div>
  );
}

export function SkillPlanSidePanel({ plan }: { plan: AgiSkillPlan | null }) {
  if (!plan) return null;
  return (
    <div className="rounded-lg border border-phantix-700/30 bg-phantix-950/50 p-2">
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">Skill plan</p>
      {(plan.skills ?? []).map((s) => (
        <div key={s.skill_id} className="flex items-center gap-1.5 py-1 text-[10px] text-slate-300">
          <span className="w-4 text-right text-slate-600">{s.rank}</span>
          <span className={cx("min-w-0 flex-1 truncate", s.role === "primary" && "text-gold-200")}>{s.skill_id}</span>
          {s.efficiency != null && <span className="font-mono text-emerald-400">{(s.efficiency * 100).toFixed(0)}%</span>}
          {s.body_loaded ? <span className="text-emerald-400">Full</span> : <span className="text-slate-600">Card</span>}
        </div>
      ))}
      {(plan.skills ?? []).length === 0 && <p className="text-[10px] text-slate-600">No skills auto-matched — AGI will use general recon and skill_search.</p>}
    </div>
  );
}

function scoreCls(score: number): string {
  if (score >= 0.7) return "text-emerald-300";
  if (score >= 0.4) return "text-severity-medium";
  return "text-severity-critical";
}

export function EngineLearningPanel({ orgId }: { orgId?: number }) {
  const [ops, setOps] = useState<AgiEngineOp[]>([]);
  const [platform, setPlatform] = useState<AgiEngineCapability[]>([]);
  const [org, setOrg] = useState<AgiEngineCapability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([loadAgiEngineCatalog(), loadAgiEngineLearning(orgId)]).then(([catalog, learning]) => {
      if (cancelled) return;
      setOps(catalog);
      setPlatform(learning.platform);
      setOrg(learning.organization);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [orgId]);

  const grouped = useMemo(() => {
    const map = new Map<string, AgiEngineOp[]>();
    for (const op of ops) {
      const list = map.get(op.engine_id) ?? [];
      list.push(op);
      map.set(op.engine_id, list);
    }
    return [...map.entries()];
  }, [ops]);

  const ranks = org.length ? org : platform;

  if (loading) return <p className="py-8 text-center text-xs text-slate-500"><Loader2 size={14} className="mr-1 inline animate-spin" /> Loading engine catalog…</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Live engine ops" subtitle="AGI reads org data through Phantix engines — never raw databases." />
        {grouped.length === 0 ? (
          <p className="text-xs text-slate-500">No catalog yet.</p>
        ) : (
          <div className="space-y-3">
            {grouped.map(([engine, list]) => (
              <div key={engine}>
                <p className="mb-1 font-mono text-[11px] font-semibold text-gold-300">{engine}</p>
                <div className="space-y-1">
                  {list.map((op) => (
                    <div key={`${op.engine_id}.${op.op}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-phantix-700/30 px-2.5 py-1.5">
                      <span className="font-mono text-[11px] text-slate-200">{op.op}</span>
                      <span className={cx("chip !text-[9px]", op.action_class === "state_changing" ? "border-severity-medium/30 text-severity-medium" : "border-emerald-400/30 text-emerald-300")}>{op.action_class}</span>
                      <span className="text-[11px] text-slate-500">{op.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title="Capability learning" subtitle={orgId ? `Org #${orgId} ranks (platform fallback below)` : "Platform-wide scores. Every engine call makes that engine smarter."} />
        {ranks.length === 0 ? (
          <p className="text-xs text-slate-500">No learning data yet — run AGI sessions that use ENGINE_CALL.</p>
        ) : (
          <div className="space-y-2">
            {ranks.map((c) => (
              <div key={`${c.engine_id}.${c.op}`} className="rounded-lg border border-phantix-700/30 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-200">{c.engine_id}.{c.op}</span>
                  <span className={cx("text-[11px] font-semibold tabular-nums", scoreCls(c.score))}>{(c.score * 100).toFixed(0)}%</span>
                  <span className="text-[10px] text-slate-500">{c.calls} calls</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-phantix-800">
                  <div className={cx("h-full", c.score >= 0.7 ? "bg-emerald-400" : c.score >= 0.4 ? "bg-severity-medium" : "bg-severity-critical")} style={{ width: `${Math.min(100, c.score * 100)}%` }} />
                </div>
                {c.tools?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {c.tools.map((t) => <span key={t} className="chip !text-[9px] font-mono text-slate-400">{t}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export function EngineSnapshotCards({
  catalogCount,
  top,
  pendingTools,
  onOpenQueue,
  onOpenEngines,
}: {
  catalogCount: number;
  top: AgiEngineCapability[];
  pendingTools: number;
  onOpenQueue: () => void;
  onOpenEngines: () => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <button onClick={onOpenQueue} className="rounded-xl border border-phantix-700/40 bg-phantix-900/40 p-4 text-left hover:border-gold-400/30">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><Wrench size={12} /> Tool provision</p>
        <p className="mt-1 font-display text-2xl font-semibold text-white">{pendingTools}</p>
        <p className="text-[11px] text-slate-500">need server-wide provision</p>
      </button>
      <button onClick={onOpenEngines} className="rounded-xl border border-phantix-700/40 bg-phantix-900/40 p-4 text-left hover:border-gold-400/30">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><Cpu size={12} /> Live ops</p>
        <p className="mt-1 font-display text-2xl font-semibold text-white">{catalogCount}</p>
        <p className="text-[11px] text-slate-500">AGI-callable engine ops</p>
      </button>
      <div className="rounded-xl border border-phantix-700/40 bg-phantix-900/40 p-4">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><Activity size={12} /> Top engines</p>
        {top.length === 0 ? <p className="mt-2 text-[11px] text-slate-500">No scores yet</p> : (
          <div className="mt-2 space-y-1">
            {top.slice(0, 3).map((c) => (
              <p key={`${c.engine_id}.${c.op}`} className="flex justify-between font-mono text-[10px] text-slate-300">
                <span>{c.engine_id}</span>
                <span className={scoreCls(c.score)}>{(c.score * 100).toFixed(0)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function JobCoveragePanel({ sessionId, job, onRefresh }: { sessionId: number; job: AgiSessionJob | null; onRefresh: () => void }) {
  const { toast } = useStore();
  const [busy, setBusy] = useState(false);
  if (!job) return null;

  const confirm = async (stop: boolean) => {
    setBusy(true);
    try {
      await confirmAgiJob(sessionId, stop, stop ? "Operator confirmed JOB_DONE" : "Keep open");
      toast("success", stop ? "Job confirmed — stopping" : "Job confirmed — session stays open");
      onRefresh();
    } catch (e) {
      toast("error", "Confirm failed", e instanceof Error ? e.message : "");
    } finally { setBusy(false); }
  };

  const waive = async (id: string) => {
    const reason = window.prompt("Waive reason?");
    if (!reason) return;
    setBusy(true);
    try {
      await waiveAgiJobObjective(sessionId, id, reason);
      toast("success", "Objective waived");
      onRefresh();
    } catch (e) {
      toast("error", "Waive failed", e instanceof Error ? e.message : "");
    } finally { setBusy(false); }
  };

  const pendingConfirm = job.job_status === "complete_pending_confirm";

  return (
    <div className="border-b border-phantix-700/40 bg-phantix-950/70 px-3 py-2">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Coverage</p>
        <StatusBadge status={job.job_status} />
        {job.active_phase && <span className="chip !text-[9px] text-gold-300">{job.active_phase}</span>}
        <span className="text-[10px] text-slate-500">{job.tools_run ?? 0} tools · {job.findings_count ?? 0} findings</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {(job.objectives ?? []).map((o) => (
          <button key={o.id} type="button" onClick={() => o.status !== "done" && o.status !== "waived" ? void waive(o.id) : undefined} className="chip !text-[9px]" title={o.detail}>
            {o.status === "done" ? "[x]" : o.status === "waived" ? "[~]" : o.status === "blocked" ? "[!]" : o.status === "active" ? "[…]" : "[ ]"} {o.title}
            {o.kind === "asset_coverage" && o.total ? ` ${o.covered ?? 0}/${o.total}` : ""}
          </button>
        ))}
      </div>
      {pendingConfirm && (
        <div className="mt-2 flex flex-wrap gap-2 rounded-lg border border-gold-400/30 bg-gold-400/10 px-2.5 py-2">
          <p className="flex-1 text-[11px] text-gold-200">Agent reports job complete — review checklist</p>
          <button disabled={busy} onClick={() => void confirm(true)} className="btn-primary !px-2 !py-1 !text-[10px]"><CheckCircle2 size={11} className="mr-1 inline" /> Confirm & stop</button>
          <button disabled={busy} onClick={() => void confirm(false)} className="btn-ghost !px-2 !py-1 !text-[10px]">Keep open</button>
        </div>
      )}
    </div>
  );
}

export function EngineCallList({ events }: { events: EngineCallEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="max-h-28 overflow-y-auto border-b border-phantix-700/30 px-3 py-1.5">
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">Engine calls</p>
      <div className="space-y-0.5">
        {events.slice(-12).map((e, i) => (
          <p key={i} className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
            {e.ok ? <CheckCircle2 size={10} className="text-emerald-400" /> : <XCircle size={10} className="text-severity-critical" />}
            {e.engine_id}.{e.op}
            {e.latency_ms != null && <span className="text-slate-600">{e.latency_ms}ms</span>}
          </p>
        ))}
      </div>
    </div>
  );
}
