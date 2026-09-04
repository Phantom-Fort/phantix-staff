import React, { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Building2, Search, Eye, Mail, Globe, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Shield, ExternalLink, Settings } from "lucide-react";
import { PageHeader, Card, StatusBadge, TableSkeleton, EmptyState, Modal } from "@/components/ui";
import { useResource } from "@/lib/useResource";
import { useStore } from "@/lib/store";
import { api, DEMO_MODE } from "@/lib/api";
import { timeAgo, cx } from "@/lib/utils";
import { APP_URL } from "@/lib/links";
import type { ClientOrg, ClientConnections, ClientExperience } from "@/lib/types";

const demoClients: ClientOrg[] = [
  { id: 1, name: "Acme Financial Group", slug: "acme-financial", email: "admin@acme.ng", country: "NG", industry: "fintech", plan: "Scale", setup_complete: true, company_verified: true, identity_verified: true, is_active: true, created_at: "2026-06-01T00:00:00Z", last_active_at: new Date().toISOString(), notes: null, flags: [] },
  { id: 2, name: "TechStart Ltd", slug: "techstart", email: "ops@techstart.io", country: "KE", industry: "technology", plan: "Start", setup_complete: true, company_verified: true, identity_verified: true, is_active: true, created_at: "2026-06-15T00:00:00Z", last_active_at: new Date(Date.now() - 86400000).toISOString(), notes: null, flags: [] },
  { id: 3, name: "HealthPlus NG", slug: "healthplus", email: "security@healthplus.ng", country: "NG", industry: "healthcare", plan: "Enterprise", setup_complete: true, company_verified: true, identity_verified: true, is_active: true, created_at: "2026-05-20T00:00:00Z", last_active_at: new Date(Date.now() - 3600000).toISOString(), notes: "HIPAA interested", flags: ["hipaa", "enterprise"] },
  { id: 4, name: "PendingCorp", slug: "pendingcorp", email: "info@pendingcorp.com", country: "ZA", industry: "consulting", plan: "Start", setup_complete: false, company_verified: false, identity_verified: false, is_active: true, created_at: "2026-07-10T00:00:00Z", last_active_at: null, notes: null, flags: ["pending_verification"] },
  { id: 5, name: "Suspended LLC", slug: "suspended-llc", email: "admin@suspended.com", country: "US", industry: "ecommerce", plan: "Scale", setup_complete: true, company_verified: true, identity_verified: true, is_active: false, created_at: "2026-04-01T00:00:00Z", last_active_at: "2026-07-01T00:00:00Z", notes: "Payment overdue", flags: ["suspended"] },
];

export default function Clients() {
  const { toast, isAdmin } = useStore();
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [suspendNote, setSuspendNote] = useState("");
  const [editingClient, setEditingClient] = useState<ClientOrg | null>(null);
  const [editForm, setEditForm] = useState({ is_active: true, admin_notes: "", admin_tags: "" });

  const clients = useResource<ClientOrg[]>(
    async (signal) => {
      if (DEMO_MODE) return demoClients;
      const raw = await api.get<any>("/admin/clients");
      const items = Array.isArray(raw) ? raw : (raw?.items ?? []);
      return items as ClientOrg[];
    },
    [],
  );

  const clientConnections = useResource<ClientConnections>(
    async (signal) => {
      if (DEMO_MODE || !selectedClient) throw new Error("No client");
      return api.get<ClientConnections>(`/admin/clients/${selectedClient}/connections`);
    },
    {} as any,
  );

  const clientDetail = useResource<ClientOrg>(
    async (signal) => {
      if (DEMO_MODE || !selectedClient) throw new Error("No client");
      return api.get<ClientOrg>(`/admin/clients/${selectedClient}`);
    },
    {} as any,
  );

  const clientExperience = useResource<ClientExperience>(
    async (signal) => {
      if (DEMO_MODE || !selectedClient) throw new Error("No client");
      return api.get<ClientExperience>(`/admin/clients/${selectedClient}/experience`);
    },
    {} as any,
  );

  const handleSelectClient = (id: number | null) => {
    setSelectedClient(id);
    if (id != null) {
      clientDetail.refresh();
      clientExperience.refresh();
    }
  };

  const data = clients.data;

  const filtered = (data || (DEMO_MODE ? demoClients : [])).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
  });

  const handleManualReview = async (id: number, approve: boolean) => {
    try {
      await api.post(`/admin/clients/${id}/verification/manual-review?approve=${approve}&notes=${encodeURIComponent("Reviewed by staff")}`);
      toast("success", approve ? "Approved" : "Rejected", `Client ${id} verification ${approve ? "approved" : "rejected"}`);
      clients.refresh();
    } catch (e) {
      toast("error", "Failed", e instanceof Error ? e.message : "");
    }
  };

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Manage all tenant organizations --- search, view details, verify, and moderate"
        actions={
          <button onClick={() => clients.refresh()} className="btn-ghost text-sm px-3 py-1.5" disabled={clients.loading}>
            <RefreshCw size={14} className={clients.loading ? "animate-spin" : ""} />
          </button>
        }
      />

      <div className="relative mb-4 max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input pl-9 py-2 text-sm" placeholder="Search by name, email, or slug..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        {clients.loading && !data ? (
          <div className="p-4"><TableSkeleton rows={8} cols={6} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Search size={24} />} title="No clients found" body="Try adjusting your search" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-phantix-700/40">
                  <th className="th">Organization</th>
                  <th className="th">Plan</th>
                  <th className="th">Setup</th>
                  <th className="th">Verified</th>
                  <th className="th">Status</th>
                  <th className="th">Last Active</th>
                  <th className="th w-12" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr key={client.id} className="border-b border-phantix-700/20 hover:bg-phantix-800/40 transition-colors">
                    <td className="td">
                      <div>
                        <p className="text-sm font-medium text-slate-100">{client.name}</p>
                        <p className="text-xs text-slate-500">{client.email} · {client.slug} · {client.country}</p>
                        {client.flags?.length > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            {client.flags.map((f) => (
                              <span key={f} className="chip text-[10px] text-severity-medium bg-severity-medium/10 border-severity-medium/20">{f}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="td"><span className="text-xs text-slate-300">{client.plan}</span></td>
                    <td className="td">{client.setup_complete ? <CheckCircle2 size={14} className="text-emerald-400" /> : <XCircle size={14} className="text-slate-500" />}</td>
                    <td className="td">{client.company_verified ? <span className="chip text-xs text-emerald-400 bg-emerald-400/10 border-emerald-400/30">Verified</span> : <span className="chip text-xs text-severity-medium bg-severity-medium/10 border-severity-medium/30">Pending</span>}</td>
                    <td className="td">{client.is_active ? <StatusBadge status="active" /> : <StatusBadge status="failed" />}</td>
                    <td className="td text-xs text-slate-500">{timeAgo(client.last_active_at)}</td>
                    <td className="td">
                      <button
                        className="btn-ghost p-1.5"
                        onClick={() => handleSelectClient(selectedClient === client.id ? null : client.id)}
                      >
                        <Eye size={14} />
                      </button>
                      <button className="btn-ghost p-1.5" onClick={() => { setEditingClient(client); setEditForm({ is_active: client.is_active, admin_notes: client.notes || "", admin_tags: (client.flags || []).join(", ") }); }} title="Edit"><Settings size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Client Detail Modal */}
      <Modal
        open={selectedClient !== null}
        onClose={() => setSelectedClient(null)}
        title="Client Details"
        wide
      >
        {selectedClient && (() => {
          const c = clientDetail.data ?? (data || (DEMO_MODE ? demoClients : [])).find((x: ClientOrg) => x.id === selectedClient);
          if (!c) return <p className="text-slate-400">Client not found</p>;
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-phantix-950/60 border border-phantix-700/40 p-3">
                  <p className="text-xs text-slate-400">Name</p>
                  <p className="text-sm text-white font-medium">{c.name}</p>
                </div>
                <div className="rounded-lg bg-phantix-950/60 border border-phantix-700/40 p-3">
                  <p className="text-xs text-slate-400">Slug</p>
                  <p className="text-sm text-white font-mono">{c.slug}</p>
                </div>
                <div className="rounded-lg bg-phantix-950/60 border border-phantix-700/40 p-3">
                  <p className="text-xs text-slate-400">Email</p>
                  <p className="text-sm text-white">{c.email}</p>
                </div>
                <div className="rounded-lg bg-phantix-950/60 border border-phantix-700/40 p-3">
                  <p className="text-xs text-slate-400">Country / Industry</p>
                  <p className="text-sm text-white">{c.country} / {c.industry}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Connections</p>
                {clientConnections.loading ? (
                  <TableSkeleton rows={2} cols={2} />
                ) : clientConnections.data ? (
                  <div className="space-y-1.5">
                    {(Array.isArray(clientConnections.data?.connections) ? clientConnections.data.connections : (Array.isArray(clientConnections.data) ? clientConnections.data : [])).map((conn: any) => (
                      <div key={conn.id} className="flex items-center justify-between rounded-lg bg-phantix-950/60 border border-phantix-700/40 px-3 py-2">
                        <span className="text-sm text-slate-300">{conn.name} ({conn.db_type})</span>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={conn.bootstrap_status} />
                          {conn.last_test_ok ? <CheckCircle2 size={14} className="text-emerald-400" /> : <AlertTriangle size={14} className="text-severity-medium" />}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No connections configured</p>
                )}
                {clientConnections.data && (
                  <p className="text-xs text-slate-400 mt-1">
                    Security DB: {(clientConnections.data as any).security_db_ready ? <span className="text-emerald-400">Ready</span> : <span className="text-severity-medium">Not Ready</span>}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Experience</p>
                {clientExperience.loading ? (
                  <TableSkeleton rows={2} cols={2} />
                ) : clientExperience.data ? (
                  <div className="space-y-1.5">
                    {(Array.isArray(clientExperience.data) ? clientExperience.data : []).map((svc: any) => (
                      <div key={String(svc.service_key ?? svc.key ?? "svc")} className="flex items-center justify-between rounded-lg bg-phantix-950/60 border border-phantix-700/40 px-3 py-2">
                        <span className="text-sm text-slate-300">{svc.label ?? svc.service_key}</span>
                        <div className="flex gap-1">
                          {(svc.modules ?? []).slice(0, 3).map((m: string) => (
                            <span key={m} className="chip text-[10px] text-phantix-300 bg-phantix-500/10 border-phantix-500/20">{m}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Experience profile unavailable</p>
                )}
              </div>

              {isAdmin && !c.company_verified && (c.flags?.includes("pending_verification") || !c.setup_complete) && (
                <div className="flex items-center gap-2">
                  <button onClick={() => handleManualReview(c.id, true)} className="btn-primary text-xs px-3 py-1.5">Approve Verification</button>
                  <button onClick={() => handleManualReview(c.id, false)} className="btn-danger text-xs px-3 py-1.5">Reject</button>
                </div>
              )}

              <a
                href={`${APP_URL}/dashboard`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary w-full text-sm"
              >
                <ExternalLink size={14} /> Launch as Customer
              </a>
            </div>
          );
        })()}
      </Modal>

      <Modal open={!!editingClient} onClose={() => setEditingClient(null)} title={editingClient ? `Edit: ${editingClient.name}` : ""}>
        {editingClient && (
          <div className="space-y-3">
            <div><label className="label">Status</label>
              <select className="input" value={editForm.is_active ? "true" : "false"} onChange={e => setEditForm(f => ({...f, is_active: e.target.value === "true"}))}>
                <option value="true">Active</option><option value="false">Suspended</option>
              </select>
            </div>
            <div><label className="label">Admin Notes</label><textarea className="input resize-none" rows={2} value={editForm.admin_notes} onChange={e => setEditForm(f => ({...f, admin_notes: e.target.value}))} /></div>
            <div><label className="label">Tags (comma separated)</label><input className="input" value={editForm.admin_tags} onChange={e => setEditForm(f => ({...f, admin_tags: e.target.value}))} /></div>
            <button onClick={async () => {
              try {
                await api.patch(`/admin/clients/${editingClient.id}`, { is_active: editForm.is_active, admin_notes: editForm.admin_notes, admin_tags: editForm.admin_tags.split(",").map(s => s.trim()).filter(Boolean) });
                toast("success", "Client updated");
                setEditingClient(null); clients.refresh();
              } catch(e) { toast("error", e instanceof Error ? e.message : ""); }
            }} className="btn-primary w-full">Save Changes</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
