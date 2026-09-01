import React, { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Mail, Lock, Eye, EyeOff, Loader2, AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";
import { DEMO_MODE } from "@/lib/api";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Login() {
  const { session, login } = useStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (session?.authenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Enter your staff email and password");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed --- check your credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <div className="absolute right-6 top-6 z-20"><ThemeToggle /></div>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <BrandLogo className="h-14 w-auto mb-4" />
          <h1 className="font-display text-xl font-bold text-white">Staff Portal</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in with your staff account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {DEMO_MODE && (
            <div className="flex items-center gap-2 rounded-lg bg-severity-medium/10 border border-severity-medium/30 px-3 py-2 text-xs text-severity-medium">
              <AlertTriangle size={14} />
              Demo mode --- any email + any password works
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-severity-critical/10 border border-severity-critical/30 px-3 py-2 text-xs text-severity-critical">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}

          <div>
            <label className="label">Staff Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                className="input pl-9"
                placeholder="admin@phantixlabs.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type={showPw ? "text" : "password"}
                className="input pl-9 pr-9"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                onClick={() => setShowPw(!showPw)}
              >
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading && <Loader2 size={16} className="animate-spin" />}
            Sign In
          </button>
          <p className="mt-3 text-center text-xs">
            <Link to="/password-reset" className="text-slate-500 hover:text-slate-300">Forgot password?</Link>
          </p>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6">
          Staff accounts only --- for internal use
        </p>
      </motion.div>
    </div>
  );
}
