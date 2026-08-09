import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { StoreProvider, ToastViewport, useStore } from "@/lib/store";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/admin/Clients";
import SupportTickets from "@/pages/admin/Support";
import ServerOps from "@/pages/admin/ServerOps";
import AiAdmin from "@/pages/admin/AiAdmin";
import ComplianceAdmin from "@/pages/admin/Compliance";
import ToolingAdmin from "@/pages/admin/Tooling";
import ExperienceAdmin from "@/pages/admin/Experience";
import ScannerTools from "@/pages/admin/ScannerTools";
import BillingAdmin from "@/pages/admin/Billing";
import StaffUsers from "@/pages/admin/StaffUsersPage";
import DevLogs from "@/pages/admin/DevLogs";
import DiscoveryAdmin from "@/pages/admin/Discovery";
import VaptAdmin from "@/pages/admin/VaptAdmin";
import BusDiagnostics from "@/pages/admin/BusDiagnostics";
import SuperLogs from "@/pages/admin/SuperLogs";
import EngineJobs from "@/pages/admin/EngineJobs";
import SuperadminTerminal from "@/pages/admin/Terminal";
import AgiAdmin from "@/pages/admin/AgiAdmin";

function RequireStaff({ children }: { children: React.ReactNode }) {
  const { session } = useStore();
  const location = useLocation();
  if (!session?.authenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { session, isAdmin } = useStore();
  const location = useLocation();
  if (!session?.authenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function RequireSuperadmin({ children }: { children: React.ReactNode }) {
  const { session, isSuperadmin } = useStore();
  if (!session?.authenticated) return <Navigate to="/login" replace />;
  if (!isSuperadmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function RequireAgiAdmin({ children }: { children: React.ReactNode }) {
  const { session, isAgiAdmin } = useStore();
  const location = useLocation();
  if (!session?.authenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isAgiAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            {/* All staff */}
            <Route path="/dashboard" element={<RequireStaff><Dashboard /></RequireStaff>} />
            <Route path="/support" element={<RequireStaff><SupportTickets /></RequireStaff>} />

            {/* Admin (monitor + catalogs + advanced) */}
            <Route path="/clients" element={<RequireAdmin><Clients /></RequireAdmin>} />
            <Route path="/clients/:id" element={<RequireAdmin><Clients /></RequireAdmin>} />
            <Route path="/logs" element={<RequireAdmin><DevLogs /></RequireAdmin>} />
            <Route path="/logs/issues/:issueId" element={<RequireAdmin><DevLogs /></RequireAdmin>} />
            <Route path="/server" element={<RequireAdmin><ServerOps /></RequireAdmin>} />
            <Route path="/scanner-tools" element={<RequireAdmin><ScannerTools /></RequireAdmin>} />
            <Route path="/bus" element={<RequireAdmin><BusDiagnostics /></RequireAdmin>} />
            <Route path="/compliance" element={<RequireAdmin><ComplianceAdmin /></RequireAdmin>} />
            <Route path="/tooling" element={<RequireAdmin><ToolingAdmin /></RequireAdmin>} />
            <Route path="/discovery" element={<RequireAdmin><DiscoveryAdmin /></RequireAdmin>} />
            <Route path="/experience" element={<RequireAdmin><ExperienceAdmin /></RequireAdmin>} />
            <Route path="/ai" element={<RequireAdmin><AiAdmin /></RequireAdmin>} />
            <Route path="/vapt-admin" element={<RequireAdmin><VaptAdmin /></RequireAdmin>} />
            <Route path="/agi" element={<RequireAgiAdmin><AgiAdmin /></RequireAgiAdmin>} />

            {/* Superadmin */}
            <Route path="/super-logs" element={<RequireSuperadmin><SuperLogs /></RequireSuperadmin>} />
            <Route path="/engine-jobs" element={<RequireSuperadmin><EngineJobs /></RequireSuperadmin>} />
            <Route path="/terminal" element={<RequireSuperadmin><SuperadminTerminal /></RequireSuperadmin>} />
            <Route path="/billing" element={<RequireSuperadmin><BillingAdmin /></RequireSuperadmin>} />
            <Route path="/staff" element={<RequireSuperadmin><StaffUsers /></RequireSuperadmin>} />

            {/* Default redirects */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
        <ToastViewport />
      </BrowserRouter>
    </StoreProvider>
  );
}
