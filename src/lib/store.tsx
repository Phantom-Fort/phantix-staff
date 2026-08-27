import React, { createContext, useCallback, useContext, useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { tokens, api, emailFromToken, roleFromToken, DEMO_MODE, delay, clearCorrelationId } from "./api";
import type { StaffUser, StaffRole } from "./types";

type StaffSession = {
  authenticated: boolean;
  email: string;
  fullName: string;
  role: StaffRole;
  agi_admin?: boolean;
} | null;

type ToastKind = "success" | "error" | "info" | "warning";
type Toast = { id: number; kind: ToastKind; title: string; body?: string };

type Store = {
  session: StaffSession;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hydrateSession: () => void;
  isAdmin: boolean;
  isSuperadmin: boolean;
  isAgiAdmin: boolean;
  toasts: Toast[];
  toast: (kind: ToastKind, title: string, body?: string) => void;
  dismissToast: (id: number) => void;
};

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StaffSession>(() => {
    if (!tokens.staff) return null;
    const email = tokens.email || emailFromToken() || "";
    const role = roleFromToken() as StaffRole;
    return { authenticated: true, email, fullName: "", role: role || "support" };
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((kind: ToastKind, title: string, body?: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, kind, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const login = useCallback(async (email: string, password: string) => {
    if (DEMO_MODE) {
      await delay(600);
      tokens.staff = "demo.staff.jwt";
      tokens.email = email;
      setSession({
        authenticated: true,
        email,
        fullName: email.split("@")[0],
        role: email.includes("super") ? "superadmin" : email.includes("admin") ? "admin" : "support",
      });
      return;
    }
    const res = await api.postForm<{
      access_token: string;
      token_type: string;
      staff_id: number;
      email: string;
      full_name: string;
      role: StaffRole;
    }>("/staff/login", { username: email, password });
    tokens.staff = res.access_token;
    tokens.email = res.email || email;
    // Fetch full profile
    let fullName = res.full_name || email;
    let role: StaffRole = res.role || "support";
    let agiAdmin = false;
    try {
      const me = await api.get<{ full_name: string; role: StaffRole; email: string; is_active: boolean; agi_admin?: boolean }>("/staff/me");
      fullName = me.full_name || fullName;
      role = me.role || role;
      agiAdmin = Boolean(me.agi_admin);
      if (me.email) tokens.email = me.email;
    } catch { /* keep login response values */ }
    setSession({ authenticated: true, email: tokens.email || email, fullName, role, agi_admin: agiAdmin });
  }, []);

  const logout = useCallback(() => {
    tokens.staff = null;
    tokens.email = null;
    clearCorrelationId();
    setSession(null);
  }, []);

  const hydrateSession = useCallback(async () => {
    if (!tokens.staff) return;
    try {
      const me = await api.get<{ full_name: string; role: StaffRole; email: string; is_active: boolean; agi_admin?: boolean }>("/staff/me");
      const email = me.email || tokens.email || emailFromToken() || "";
      tokens.email = email;
      setSession({ authenticated: true, email, fullName: me.full_name || "", role: me.role || "support", agi_admin: Boolean(me.agi_admin) });
    } catch {
      const email = tokens.email || emailFromToken() || "";
      if (email) setSession({ authenticated: true, email, fullName: "", role: "support" });
    }
  }, []);

  const isAdmin = session?.role === "admin" || session?.role === "superadmin";
  const isSuperadmin = session?.role === "superadmin";
  const isAgiAdmin = Boolean(session?.agi_admin) || isSuperadmin;

  // Auto-redirect to login when token expires (401 clears tokens via api client)
  useEffect(() => {
    const check = () => {
      if (session && !tokens.staff) {
        setSession(null);
      }
    };
    const interval = setInterval(check, 2000);
    window.addEventListener("storage", check);
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", check);
    };
  }, [session]);

  return (
    <Ctx.Provider value={{ session, login, logout, hydrateSession, isAdmin, isSuperadmin, isAgiAdmin, toasts, toast, dismissToast }}>
      {children}
    </Ctx.Provider>
  );
}

export function ToastViewport() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const icon =
            t.kind === "success" ? <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            : t.kind === "error" ? <XCircle size={18} className="text-severity-critical shrink-0" />
            : t.kind === "warning" ? <AlertTriangle size={18} className="text-severity-medium shrink-0" />
            : <Info size={18} className="text-phantix-400 shrink-0" />;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              className="pointer-events-auto glass-bright flex items-start gap-3 rounded-xl px-4 py-3 shadow-card max-w-sm"
            >
              {icon}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{t.title}</p>
                {t.body && <p className="text-xs text-slate-400 mt-0.5">{t.body}</p>}
              </div>
              <button onClick={() => dismissToast(t.id)} className="shrink-0 text-slate-500 hover:text-white">
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
