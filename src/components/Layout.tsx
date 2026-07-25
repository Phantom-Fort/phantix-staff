import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Shield, Building2, MessageSquare, Server, Brain,
  Users, FileCheck, Wrench, Search, Activity, LogOut, Menu, X,
  Zap, Globe, AlertTriangle, ScanLine, BarChart3, RefreshCw,
  Crosshair, Radio, FileText,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { APP_URL } from "@/lib/links";
import { cx } from "@/lib/utils";

const navSections: {
  label: string;
  role: "all" | "admin" | "superadmin";
  items: {
    to: string;
    label: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
    superadminOnly?: boolean;
  }[];
}[] = [
  {
    label: "Overview",
    role: "all",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
      { to: "/clients", label: "Clients", icon: <Building2 size={18} />, adminOnly: true },
      { to: "/support", label: "Support", icon: <MessageSquare size={18} /> },
    ],
  },
  {
    label: "Monitor",
    role: "admin",
    items: [
      { to: "/logs", label: "Logs", icon: <FileText size={18} /> },
      { to: "/server", label: "Server", icon: <Server size={18} /> },
      { to: "/scanner-tools", label: "Scanner Tools", icon: <ScanLine size={18} /> },
      { to: "/bus", label: "Event Bus", icon: <Radio size={18} /> },
    ],
  },
  {
    label: "Catalogs",
    role: "admin",
    items: [
      { to: "/compliance", label: "Compliance", icon: <FileCheck size={18} /> },
      { to: "/tooling", label: "Tooling", icon: <Wrench size={18} /> },
      { to: "/discovery", label: "Discovery", icon: <Search size={18} /> },
      { to: "/experience", label: "Experience", icon: <Zap size={18} /> },
    ],
  },
  {
    label: "Advanced",
    role: "admin",
    items: [
      { to: "/ai", label: "AI Admin", icon: <Brain size={18} /> },
      { to: "/vapt-admin", label: "VAPT Admin", icon: <Crosshair size={18} /> },
    ],
  },
  {
    label: "Operations",
    role: "superadmin",
    items: [
      { to: "/super-logs", label: "Centralized Logs", icon: <FileText size={18} />, superadminOnly: true },
      { to: "/engine-jobs", label: "Engine Jobs", icon: <Activity size={18} />, superadminOnly: true },
      { to: "/billing", label: "Billing", icon: <BarChart3 size={18} />, superadminOnly: true },
      { to: "/staff", label: "Staff Users", icon: <Users size={18} />, superadminOnly: true },
    ],
  },
];

export default function Layout() {
  const { session, logout, isAdmin, isSuperadmin } = useStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const roleBadge =
    session?.role === "superadmin" ? "text-severity-critical bg-severity-critical/10 border-severity-critical/30"
    : session?.role === "admin" ? "text-severity-high bg-severity-high/10 border-severity-high/30"
    : "text-severity-low bg-severity-low/10 border-severity-low/30";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-[248px] shrink-0 flex-col border-r border-phantix-700/30 bg-phantix-950/80 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-5 border-b border-phantix-700/30">
          <img src="/logo-white.png" alt="Phantix" className="h-7 w-auto object-contain" />
          <div>
            <p className="font-display text-sm font-bold text-white tracking-tight">Staff Portal</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navSections.map((section) => {
            if (section.role === "admin" && !isAdmin) return null;
            if (section.role === "superadmin" && !isSuperadmin) return null;
            const visibleItems = section.items.filter((item) => {
              if (item.superadminOnly && !isSuperadmin) return false;
              if (item.adminOnly && !isAdmin) return false;
              return true;
            });
            if (!visibleItems.length) return null;

            return (
              <div key={section.label}>
                <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  {section.label}
                </p>
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/dashboard"}
                    className={({ isActive }) =>
                      cx("nav-item", isActive && "active")
                    }
                  >
                    {item.icon}
                    {item.label}
                  </NavLink>
                ))}
              </div>
            );
          })}

          {/* Launch app */}
          <div className="px-3">
            <a
              href={APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-item text-phantix-300"
            >
              <Globe size={18} />
              Launch App
            </a>
          </div>
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-phantix-700/30 bg-phantix-950/60 backdrop-blur-xl px-4 lg:px-6">
          <button
            className="lg:hidden rounded-lg p-2 text-slate-400 hover:bg-phantix-800/70 hover:text-white"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <span className={cx("chip capitalize", roleBadge)}>
              {session?.role || "staff"}
            </span>
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-slate-200">{session?.fullName || session?.email}</p>
              {session?.email && <p className="text-xs text-slate-500">{session.email}</p>}
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-slate-400 hover:bg-phantix-800/70 hover:text-severity-critical transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Mobile menu */}
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-phantix-950/95 border-b border-phantix-700/30 overflow-y-auto max-h-[60vh]"
          >
            <nav className="px-4 py-3 space-y-2">
              {navSections.map((section) => {
                if (section.role === "admin" && !isAdmin) return null;
                if (section.role === "superadmin" && !isSuperadmin) return null;
                const visibleItems = section.items.filter((item) => {
                  if (item.superadminOnly && !isSuperadmin) return false;
                  if (item.adminOnly && !isAdmin) return false;
                  return true;
                });
                if (!visibleItems.length) return null;
                return (
                  <div key={section.label} className="mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">{section.label}</p>
                    {visibleItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMenuOpen(false)}
                        className={({ isActive }) => cx("nav-item py-2", isActive && "active")}
                      >
                        {item.icon}
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                );
              })}
            </nav>
          </motion.div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
