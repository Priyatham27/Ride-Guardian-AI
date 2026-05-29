"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Shield, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import {
  getFirebaseAuth,
  signInWithEmailAndPassword,
} from "@/lib/firebase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      // AuthContext will detect the auth state change and redirect
    } catch (err: any) {
      let msg = "Login failed. Please try again.";
      if (err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password") {
        msg = "Invalid email or password.";
      } else if (err?.code === "auth/user-not-found") {
        msg = "No account found with this email. Please register first.";
      } else if (err?.code === "auth/too-many-requests") {
        msg = "Too many failed attempts. Please try again later.";
      } else if (err?.code === "auth/invalid-email") {
        msg = "Please enter a valid email address.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-guardian-bg flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-guardian-accent to-guardian-safe flex items-center justify-center shadow-2xl mb-4">
            <Shield size={32} className="text-slate-950" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-guardian-text">RideGuardian AI</h1>
          <p className="text-xs text-guardian-muted mt-1 uppercase tracking-widest">Solo Travel Sentinel</p>
        </div>

        {/* Card */}
        <div className="bg-guardian-card border border-guardian-border rounded-2xl p-6 shadow-2xl">
          <h2 className="text-lg font-bold text-guardian-text mb-1">Welcome back</h2>
          <p className="text-xs text-guardian-muted mb-6">Sign in to your guardian account</p>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-guardian-critical/10 border border-guardian-critical/30 text-xs text-guardian-critical">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-guardian-muted" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl pl-9 pr-4 py-3 text-sm text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-guardian-muted" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl pl-9 pr-10 py-3 text-sm text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-guardian-muted hover:text-guardian-text"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="btn-login-email"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-guardian-accent to-blue-500 text-white font-bold text-sm shadow-lg transition hover:opacity-90 active:scale-95 disabled:opacity-50"
            >
              {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
              {loading ? "Signing in..." : "Sign In"}
              {!loading && <ArrowRight size={15} />}
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-6 text-center text-xs text-guardian-muted">
            New to RideGuardian?{" "}
            <Link href="/register" className="text-guardian-accent font-bold hover:underline">
              Create account
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-guardian-muted/40 mt-8">
          RideGuardian AI • Solo Travel Sentinel
        </p>
      </div>
    </main>
  );
}
