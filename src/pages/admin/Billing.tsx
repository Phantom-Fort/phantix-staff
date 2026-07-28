import React, { useState } from "react";
import { BarChart3, DollarSign, RefreshCw, AlertTriangle, CreditCard, Ticket, Copy, XCircle, CheckCircle2, ToggleLeft, ToggleRight } from "lucide-react";
import { PageHeader, Card, CardHeader, StatCard, TableSkeleton, Modal, Tabs, EmptyState } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { api, DEMO_MODE } from "@/lib/api";
import { formatNaira, timeAgo, cx } from "@/lib/utils";
import type { BillingSettings, PricingPreview } from "@/lib/types";

interface GatewayStatus { configured: boolean; test_mode: boolean; public_key_prefix: string; secret_key_configured: boolean; callback_url: string; environment: string; }
interface CouponItem { id: number; label: string; code: string; duration_days: number; max_redemptions: number; redeemed_count: number; is_active: boolean; notes: string; created_at: string; }
interface RedemptionItem { id: number; organization_id: number; coupon_id: number; code: string; redeemed_at: string; access_ends_at: string; status: string; }

const demoBilling: BillingSettings = { monthly_price_ngn: 100000, yearly_price_ngn: 1000000, currency: "NGN", updated_at: "2026-07-01T00:00:00Z" };
const demoPricing: PricingPreview = { monthly: 100000, yearly: 1000000, yearly_monthly_eq: 83333, savings_percent: 17 };
const demoGateway: GatewayStatus = { configured: true, test_mode: true, public_key_prefix: "pk_test_abc...", secret_key_configured: true, callback_url: "https://platform.phantix.site/billing/callback", environment: "staging" };
const demoCoupons: CouponItem[] = [{ id: 1, label: "Design Partners", code: "BETA-7F3K-9Q2M", duration_days: 31, max_redemptions: 1, redeemed_count: 0, is_active: true, notes: "Q3 partners", created_at: new Date().toISOString() }];
const demoRedemptions: RedemptionItem[] = [{ id: 1, organization_id: 24, coupon_id: 1, code: "BETA-7F3K-9Q2M", redeemed_at: "2026-07-28T10:00:00Z", access_ends_at: "2026-08-28T10:00:00Z", status: "active" }];

export default function BillingAdmin() {
  const { toast } = useStore();
  const [tab, setTab] = useState("pricing");
  const [showPriceChange, setShowPriceChange] = useState(false);
  const [showRenewalConfirm, setShowRenewalConfirm] = useState(false);
  const [showCouponGen, setShowCouponGen] = useState(false);
  const [newMonthlyPrice, setNewMonthlyPrice] = useState("");
  const [newYearlyMonthEq, setNewYearlyMonthEq] = useState("10");
  const [discountPercent, setDiscountPercent] = useState(50);
  const [isActive, setIsActive] = useState(true);
  const [couponForm, setCouponForm] = useState({ label: "", duration_days: 31, count: 5, notes: "" });
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [gateway, setGateway] = useState<GatewayStatus | null>(null);
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionItem[]>([]);

  const { data: billing, loading, refresh } = useResource<BillingSettings>(async () => DEMO_MODE ? demoBilling : api.get("/admin/billing/settings"), []);
  const { data: pricing } = useResource<PricingPreview>(async () => DEMO_MODE ? demoPricing : api.get("/admin/billing/pricing-preview"), []);

  React.useEffect(() => {
    if (!DEMO_MODE) {
      api.get<GatewayStatus>("/admin/billing/gateway").then(setGateway).catch(() => {});
      api.get<{ items: CouponItem[] }>("/admin/coupons").then(r => setCoupons(r.items ?? [])).catch(() => {});
      api.get<{ items: RedemptionItem[] }>("/admin/coupon-redemptions?limit=20").then(r => setRedemptions(r.items ?? [])).catch(() => {});
    } else {
      setGateway(demoGateway); setCoupons(demoCoupons); setRedemptions(demoRedemptions);
    }
  }, []);

  const handlePriceChange = async () => {
    const monthly = Number(newMonthlyPrice);
    if (!monthly || monthly < 0) { toast("error", "Invalid price"); return; }
    try {
      await api.put("/admin/billing/settings", { monthly_price_ngn: monthly, yearly_month_equivalent: Number(newYearlyMonthEq) || 10, first_month_discount_percent: discountPercent, is_active: isActive, notes: "Updated via staff portal" });
      toast("success", "Price updated");
      setShowPriceChange(false);
      refresh();
    } catch (e) { toast("error", "Update failed", e instanceof Error ? e.message : ""); }
  };

  const handleGenerateCoupons = async () => {
    try {
      const res = await api.post<{ codes: string[]; count: number }>("/admin/coupons", { label: couponForm.label, duration_days: Math.min(31, couponForm.duration_days), count: Math.min(50, couponForm.count), notes: couponForm.notes });
      setGeneratedCodes(res.codes ?? []);
      toast("success", `${res.count ?? couponForm.count} codes generated`);
    } catch (e) { toast("error", "Failed", e instanceof Error ? e.message : ""); }
  };

  const handleDeactivateCoupon = async (id: number) => {
    try { await api.patch(`/admin/coupons/${id}`, { is_active: false, notes: "Deactivated via staff portal" }); toast("success", "Deactivated"); setCoupons(cs => cs.map(c => c.id === id ? { ...c, is_active: false } : c)); } catch (e) { toast("error", "Failed"); }
  };

  const handleRunRenewals = async () => { try { await api.post("/admin/billing/run-renewals", {}); toast("success", "Renewals triggered"); setShowRenewalConfirm(false); } catch (e) { toast("error", "Failed", e instanceof Error ? e.message : ""); } };

  return (
    <div>
      <PageHeader title="Billing Admin" description="Manage platform pricing, gateway status, coupons, and renewals" actions={<button onClick={refresh} className="btn-ghost text-sm px-3 py-1.5"><RefreshCw size={14} /></button>} />
      <Tabs tabs={[{ id: "pricing", label: "Pricing" }, { id: "gateway", label: "Gateway" }, { id: "coupons", label: `Coupons (${coupons.length})` }, { id: "redemptions", label: `Redemptions (${redemptions.length})` }]} active={tab} onChange={setTab} />

      {tab === "pricing" && (
        <div className="space-y-4">
          {loading ? <TableSkeleton rows={3} /> : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <StatCard label="Monthly List Price" value={formatNaira(billing?.monthly_price_ngn || 0)} icon={<DollarSign size={18} />} />
                <StatCard label="Yearly Price" value={formatNaira(billing?.yearly_price_ngn || 0)} icon={<BarChart3 size={18} />} />
                <StatCard label="Yearly Savings" value={`${pricing?.savings_percent ?? 0}%`} icon={<DollarSign size={18} />} />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => { setNewMonthlyPrice(String(billing?.monthly_price_ngn || 100000)); setNewYearlyMonthEq("10"); setDiscountPercent(50); setShowPriceChange(true); }} className="btn-secondary text-sm">Change Pricing</button>
                <button onClick={() => setShowRenewalConfirm(true)} className="btn-secondary text-sm"><RefreshCw size={14} /> Run Renewals</button>
              </div>
            </>
          )}
          <Modal open={showPriceChange} onClose={() => setShowPriceChange(false)} title="Change Platform Pricing">
            <div className="space-y-3">
              <div><label className="label">Monthly Price (NGN)</label><input className="input font-mono" type="number" value={newMonthlyPrice} onChange={e => setNewMonthlyPrice(e.target.value)} /></div>
              <div className="flex items-center justify-between"><label className="label">First-month discount</label><span className="text-gold-300 font-mono">{discountPercent}%</span></div>
              <input type="range" min={0} max={100} value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))} className="w-full accent-gold-400" />
              <div><label className="label">Yearly months equivalent</label><input className="input font-mono w-20" type="number" min={1} max={12} value={newYearlyMonthEq} onChange={e => setNewYearlyMonthEq(e.target.value)} /></div>
              <div className="flex items-center gap-2"><label className="label">Active</label><button onClick={() => setIsActive(!isActive)}>{isActive ? <ToggleRight size={20} className="text-emerald-400" /> : <ToggleLeft size={20} className="text-slate-500" />}</button><span className="text-xs text-slate-400">{isActive ? "New subscriptions allowed" : "Blocking new subscriptions"}</span></div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-severity-high/10 border border-severity-high/20 text-xs text-severity-high"><AlertTriangle size={14} />Changing pricing affects all future subscriptions.</div>
              <button onClick={handlePriceChange} className="btn-primary w-full">Confirm</button>
            </div>
          </Modal>
        </div>
      )}

      {tab === "gateway" && (
        <div className="space-y-4">
          {gateway ? (
            <Card>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-400">Status:</span> <span className={gateway.configured ? "text-emerald-400" : "text-severity-critical"}>{gateway.configured ? "Configured" : "Not configured"}</span></div>
                <div><span className="text-slate-400">Mode:</span> <span className={cx(gateway.test_mode ? "text-amber-400" : "text-emerald-400")}>{gateway.test_mode ? " TEST KEYS" : " LIVE KEYS"}</span></div>
                <div><span className="text-slate-400">Public key:</span> <span className="font-mono text-xs text-slate-300">{gateway.public_key_prefix}</span></div>
                <div><span className="text-slate-400">Secret key:</span> <span className={gateway.secret_key_configured ? "text-emerald-400" : "text-severity-critical"}>{gateway.secret_key_configured ? "Configured" : "NOT SET"}</span></div>
                <div className="col-span-2"><span className="text-slate-400">Env:</span> <span className="font-mono text-xs text-slate-300">{gateway.environment}</span></div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-slate-400">Webhook:</span>
                <code className="text-[11px] bg-phantix-950/70 px-2 py-1 rounded font-mono text-slate-300">{gateway.callback_url || `${import.meta.env.VITE_API_BASE ?? ""}/billing/webhooks/paystack`}</code>
                <button onClick={() => { navigator.clipboard.writeText(gateway.callback_url || ""); toast("info", "Copied"); }} className="text-gold-400 text-xs"><Copy size={12} /></button>
              </div>
            </Card>
          ) : <TableSkeleton rows={3} />}
        </div>
      )}

      {tab === "coupons" && (
        <div className="space-y-4">
          <button onClick={() => setShowCouponGen(true)} className="btn-primary text-sm"><Ticket size={14} /> Generate Coupons</button>
          {coupons.length === 0 ? <EmptyState icon={<Ticket size={24} />} title="No coupons" body="Generate beta access codes for trial access." /> : (
            <div className="space-y-2">
              {coupons.map(c => (
                <Card key={c.id}><div className="flex flex-wrap items-center gap-3"><span className={cx("chip", c.is_active ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-slate-500/50 bg-slate-500/10 text-slate-500")}>{c.is_active ? "Active" : "Inactive"}</span><span className="font-mono text-sm text-slate-200">{c.code}</span><span className="text-xs text-slate-400">{c.label} — {c.duration_days}d · {c.redeemed_count}/{c.max_redemptions} used</span><span className="ml-auto text-xs text-slate-500">{timeAgo(c.created_at)}</span>{c.is_active && <button onClick={() => handleDeactivateCoupon(c.id)} className="btn-ghost text-xs px-2 py-1 text-severity-critical"><XCircle size={12} /></button>}</div></Card>
              ))}
            </div>
          )}
          <Modal open={showCouponGen} onClose={() => setShowCouponGen(false)} title="Generate Coupons">
            <div className="space-y-3">
              <div><label className="label">Label</label><input className="input" value={couponForm.label} onChange={e => setCouponForm({ ...couponForm, label: e.target.value })} placeholder="Design Partners July" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Duration (days, max 31)</label><input className="input font-mono" type="number" min={1} max={31} value={couponForm.duration_days} onChange={e => setCouponForm({ ...couponForm, duration_days: Math.min(31, Number(e.target.value) || 1) })} /></div>
                <div><label className="label">Count (max 50)</label><input className="input font-mono" type="number" min={1} max={50} value={couponForm.count} onChange={e => setCouponForm({ ...couponForm, count: Math.min(50, Number(e.target.value) || 1) })} /></div>
              </div>
              <div><label className="label">Notes</label><textarea className="input" value={couponForm.notes} onChange={e => setCouponForm({ ...couponForm, notes: e.target.value })} /></div>
              <button onClick={handleGenerateCoupons} className="btn-primary w-full">Generate</button>
              {generatedCodes.length > 0 && (
                <div className="mt-3 p-3 rounded-xl bg-gold-400/10 border border-gold-400/20">
                  <p className="text-xs font-semibold text-gold-300 mb-2">Copy these codes — they won't be shown again:</p>
                  {generatedCodes.map(code => <div key={code} className="flex items-center gap-2 font-mono text-xs text-white py-1"><span>{code}</span><button onClick={() => { navigator.clipboard.writeText(code); toast("info", "Copied"); }} className="text-gold-400"><Copy size={11} /></button></div>)}
                </div>
              )}
            </div>
          </Modal>
        </div>
      )}

      {tab === "redemptions" && (
        <div className="space-y-2">
          {redemptions.length === 0 ? <EmptyState icon={<CheckCircle2 size={24} />} title="No redemptions" body="No organizations have redeemed coupons yet." /> : (
            <Card className="!p-0 overflow-hidden"><table className="w-full"><thead><tr className="border-b border-phantix-700/40"><th className="th">Code</th><th className="th">Org ID</th><th className="th">Redeemed</th><th className="th">Expires</th><th className="th">Status</th></tr></thead><tbody>{redemptions.map(r => <tr key={r.id} className="border-b border-phantix-800/40"><td className="td font-mono text-xs text-gold-300">{r.code}</td><td className="td text-xs">#{r.organization_id}</td><td className="td text-xs text-slate-400">{timeAgo(r.redeemed_at)}</td><td className="td text-xs text-slate-400">{timeAgo(r.access_ends_at)}</td><td className="td"><span className={cx("chip text-[10px]", r.status === "active" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-slate-500/50 bg-slate-500/10 text-slate-500")}>{r.status}</span></td></tr>)}</tbody></table></Card>
          )}
        </div>
      )}

      <Modal open={showRenewalConfirm} onClose={() => setShowRenewalConfirm(false)} title="Run Renewals">
        <div className="space-y-3"><p className="text-sm text-slate-400">This triggers the renewal job that processes due subscriptions and generates invoices.</p><button onClick={handleRunRenewals} className="btn-primary w-full">Run Now</button></div>
      </Modal>
    </div>
  );
}
