import React from "react";
import { motion } from "framer-motion";
import { Building2, MessageSquare, Server, Wrench, FileText, Activity, CheckCircle2, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader, StatCard, AnimatedNumber, Card, CardHeader, TableSkeleton } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { useSmartPoll } from "@/lib/usePolling";
import { useStore } from "@/lib/store";
import { api, DEMO_MODE } from "@/lib/api";
import type { AdminDashboardStats } from "@/lib/types";

const demoStats: AdminDashboardStats = {
  total_clients: 24, active_clients: 24, inactive_clients: 0,
  total_connections: 12, healthy_connections: 8,
  open_support_tickets: 3, critical_open_tickets: 1,
  experience_services_configured: 15,
  clients_by_industry: { technology: 13, fintech: 6, healthcare: 2 },
  tickets_by_status: { open: 1, in_progress: 1, resolved: 1 },
};

export default function Dashboard() {
  const { isAdmin } = useStore();

  const stats = useResource<AdminDashboardStats>(
    async (signal) => {
      if (DEMO_MODE) return demoStats;
      return api.get<AdminDashboardStats>("/admin/dashboard/stats");
    },
    {} as any,
  );

  const s = DEMO_MODE ? demoStats : stats.data;

  // Smart polling: keep platform stats fresh; slow when tab hidden.
  useSmartPoll(async () => {
    if (!DEMO_MODE) stats.refresh();
  }, { intervalMs: 30000, hiddenIntervalMs: 120000 });

  return (
    <div>
      <PageHeader
        title="Staff Dashboard"
        description={isAdmin ? "Platform operations overview --- clients, connections, support" : "Support operations overview"}
      />

      {stats.loading ? (
        <TableSkeleton rows={2} />
      ) : s ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total Clients" value={<AnimatedNumber value={s.total_clients} />} icon={<Building2 size={18} />} />
          <StatCard label="Active" value={<AnimatedNumber value={s.active_clients} />} icon={<CheckCircle2 size={18} />} />
          <StatCard label="Connections" value={<>{s.healthy_connections}<span className="text-sm text-slate-500">/{s.total_connections}</span></>} icon={<Server size={18} />} />
          <StatCard label="Open Tickets" value={<AnimatedNumber value={s.open_support_tickets} />} icon={<MessageSquare size={18} />} />
        </motion.div>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Platform Health" subtitle="Connections, services, and infrastructure" />
          {s ? (
            <div className="space-y-2">
              <div className="flex justify-between rounded-lg bg-phantix-800/40 px-3 py-2.5 text-sm">
                <span className="text-slate-400">DB Connections</span>
                <span className="font-mono text-emerald-400">{s.healthy_connections}<span className="text-slate-500"> / {s.total_connections}</span> healthy</span>
              </div>
              <div className="flex justify-between rounded-lg bg-phantix-800/40 px-3 py-2.5 text-sm">
                <span className="text-slate-400">Experience Services</span>
                <span className="font-mono text-white">{s.experience_services_configured} configured</span>
              </div>
              <div className="flex justify-between rounded-lg bg-phantix-800/40 px-3 py-2.5 text-sm">
                <span className="text-slate-400">Active Clients</span>
                <span className="font-mono text-white">{s.active_clients}<span className="text-slate-500"> / {s.total_clients}</span></span>
              </div>
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader
            title="Support Overview"
            subtitle="Ticket queue and priorities"
            action={<Link to="/support" className="text-xs text-gold-400 hover:text-gold-300">View tickets</Link>}
          />
          {s ? (
            <div className="space-y-2">
              <div className="flex justify-between rounded-lg bg-phantix-800/40 px-3 py-2.5 text-sm">
                <span className="text-slate-400">Open Tickets</span>
                <Link to="/support" className="font-mono text-blue-400 hover:text-blue-300">{s.open_support_tickets}</Link>
              </div>
              {s.critical_open_tickets > 0 && (
                <div className="flex justify-between rounded-lg bg-severity-critical/5 border border-severity-critical/20 px-3 py-2.5 text-sm">
                  <span className="flex items-center gap-1 text-severity-critical"><AlertTriangle size={14} /> Critical</span>
                  <span className="font-mono text-severity-critical">{s.critical_open_tickets}</span>
                </div>
              )}
              {Object.entries(s.tickets_by_status ?? {}).length > 0 && (
                <div className="pt-2">
                  <p className="text-xs text-slate-500 mb-1.5">By Status</p>
                  {Object.entries(s.tickets_by_status ?? {}).map(([status, count]) => (
                    <div key={status} className="flex justify-between text-xs px-2 py-1">
                      <span className="text-slate-400 capitalize">{status.replace(/_/g, " ")}</span>
                      <span className="font-mono text-slate-300">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </Card>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <Link to="/clients" className="card p-4 flex items-center gap-3 hover:border-phantix-500/60 transition-colors">
          <Building2 size={20} className="text-phantix-400" />
          <div><p className="text-sm font-medium text-white">Clients</p><p className="text-xs text-slate-400">Manage tenants</p></div>
        </Link>
        <Link to="/support" className="card p-4 flex items-center gap-3 hover:border-phantix-500/60 transition-colors">
          <MessageSquare size={20} className="text-phantix-400" />
          <div><p className="text-sm font-medium text-white">Support</p><p className="text-xs text-slate-400">Ticket queue</p></div>
        </Link>
        <Link to="/logs" className="card p-4 flex items-center gap-3 hover:border-phantix-500/60 transition-colors">
          <FileText size={20} className="text-phantix-400" />
          <div><p className="text-sm font-medium text-white">Logs</p><p className="text-xs text-slate-400">Diagnostics</p></div>
        </Link>
        <Link to="/server" className="card p-4 flex items-center gap-3 hover:border-phantix-500/60 transition-colors">
          <Server size={20} className="text-phantix-400" />
          <div><p className="text-sm font-medium text-white">Server</p><p className="text-xs text-slate-400">Platform health</p></div>
        </Link>
      </motion.div>
    </div>
  );
}
