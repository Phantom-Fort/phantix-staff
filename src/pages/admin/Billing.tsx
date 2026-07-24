import React, { useState } from "react";
import { BarChart3, DollarSign, RefreshCw, AlertTriangle } from "lucide-react";
import { PageHeader, Card, CardHeader, StatCard, TableSkeleton, Modal } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { api, DEMO_MODE } from "@/lib/api";
import { formatNaira } from "@/lib/utils";
import type { BillingSettings, PricingPreview } from "@/lib/types";

const demoBilling: BillingSettings = {
  monthly_price_ngn: 100000, yearly_price_ngn: 1000000, currency: "NGN", updated_at: "2026-07-01T00:00:00Z",
};

const demoPricing: PricingPreview = {
  monthly: 100000, yearly: 1000000, yearly_monthly_eq: 83333, savings_percent: 17,
};

export default function BillingAdmin() {
  const { toast } = useStore();
  const [showPriceChange, setShowPriceChange] = useState(false);
  const [showRenewalConfirm, setShowRenewalConfirm] = useState(false);
  const [newMonthlyPrice, setNewMonthlyPrice] = useState("");
  const [newYearlyPrice, setNewYearlyPrice] = useState("");

  const { data: billing, loading, refresh } = useResource<BillingSettings>(
    async (signal) => {
      if (DEMO_MODE) return demoBilling;
      return api.get<BillingSettings>("/admin/billing/settings");
    },
    [],
  );

  const { data: pricing } = useResource<PricingPreview>(
    async (signal) => {
      if (DEMO_MODE) return demoPricing;
      return api.get<PricingPreview>("/admin/billing/pricing-preview");
    },
    [],
  );

  const data = billing;
  const preview = pricing;

  const handlePriceChange = async () => {
    const monthly = Number(newMonthlyPrice);
    const yearly = Number(newYearlyPrice);
    if (!monthly || monthly < 0) { toast("error", "Invalid price", "Enter a valid monthly amount"); return; }
    try {
      await api.put("/admin/billing/settings", {
        monthly_price_ngn: monthly,
        yearly_price_ngn: yearly || undefined,
      });
      toast("success", "Price updated", `Monthly: ${formatNaira(monthly)}`);
      setShowPriceChange(false);
      refresh();
    } catch (e) {
      toast("error", "Update failed", e instanceof Error ? e.message : "");
    }
  };

  const handleRunRenewals = async () => {
    try {
      await api.post("/admin/billing/run-renewals", {});
      toast("success", "Renewals triggered");
      setShowRenewalConfirm(false);
    } catch (e) {
      toast("error", "Failed", e instanceof Error ? e.message : "");
    }
  };

  return (
    <div>
      <PageHeader
        title="Billing Admin"
        description="Manage platform pricing and trigger renewal jobs across all tenant subscriptions"
        actions={
          <button onClick={refresh} className="btn-ghost text-sm px-3 py-1.5">
            <RefreshCw size={14} />
          </button>
        }
      />

      {loading ? <TableSkeleton rows={3} /> : (
        <div className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard label="Monthly List Price" value={formatNaira(data?.monthly_price_ngn || 0)} icon={<DollarSign size={18} />} />
            <StatCard label="Yearly Price" value={formatNaira(data?.yearly_price_ngn || 0)} icon={<BarChart3 size={18} />} />
            <StatCard
              label="Yearly Savings"
              value={`${preview?.savings_percent ?? 0}%`}
              icon={<DollarSign size={18} />}
            />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => { setNewMonthlyPrice(String(data?.monthly_price_ngn || 100000)); setNewYearlyPrice(String(data?.yearly_price_ngn || 1000000)); setShowPriceChange(true); }} className="btn-secondary text-sm">
              Change Pricing
            </button>
            <button onClick={() => setShowRenewalConfirm(true)} className="btn-secondary text-sm">
              <RefreshCw size={14} /> Run Renewals
            </button>
          </div>
        </div>
      )}

      <Modal open={showPriceChange} onClose={() => setShowPriceChange(false)} title="Change Platform Pricing">
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            This updates the global list price for all new subscriptions. Existing tenant plans are not retroactively changed. <strong>Confirm with care.</strong>
          </p>
          <div>
            <label className="label">Monthly Price (NGN)</label>
            <input className="input font-mono" type="number" value={newMonthlyPrice} onChange={(e) => setNewMonthlyPrice(e.target.value)} />
          </div>
          <div>
            <label className="label">Yearly Price (NGN)</label>
            <input className="input font-mono" type="number" value={newYearlyPrice} onChange={(e) => setNewYearlyPrice(e.target.value)} />
            <p className="text-xs text-slate-500 mt-1">Leave empty to auto-calculate from monthly</p>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-severity-high/10 border border-severity-high/20 text-xs text-severity-high">
            <AlertTriangle size={14} />
            Changing pricing affects all future subscriptions.
          </div>
          <button onClick={handlePriceChange} className="btn-primary w-full">Confirm Price Change</button>
        </div>
      </Modal>

      <Modal open={showRenewalConfirm} onClose={() => setShowRenewalConfirm(false)} title="Run Renewal Job">
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            This triggers the cron-friendly renewal job that processes due subscriptions and generates invoices. This can be run safely multiple times.
          </p>
          <button onClick={handleRunRenewals} className="btn-primary w-full">Run Renewals Now</button>
        </div>
      </Modal>
    </div>
  );
}
