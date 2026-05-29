"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Shield, Mail, Lock, Phone, User, ArrowRight, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import {
  getFirebaseAuth,
  createUserWithEmailAndPassword,
  updateProfile,
} from "@/lib/firebase";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+91");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    // Format phone number
    let formattedPhone = phone.trim();
    const digitsOnly = formattedPhone.replace(/\D/g, "");
    if (!formattedPhone.startsWith("+")) {
      formattedPhone = digitsOnly.length === 10 ? "+91" + digitsOnly : "+" + digitsOnly;
    }

    setLoading(true);
    try {
      // 1. Create Firebase email/password account
      const auth = getFirebaseAuth();
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Update display name in Firebase
      await updateProfile(user, { displayName: fullName });

      // Save registration details to localStorage for onboarding fallback/recovery
      localStorage.setItem("onboard_name", fullName);
      localStorage.setItem("onboard_phone", formattedPhone);

      // 3. Save user to backend DB
      const res = await fetch(`${apiUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firebase_uid: user.uid,
          full_name: fullName,
          email: email,
          mobile_number: formattedPhone,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Backend registration failed");
      }

      setSuccess(true);
      // AuthContext will detect auth state change and redirect to /onboarding
    } catch (err: any) {
      console.error(err);
      let msg = "Registration failed. Please try again.";
      if (err?.code === "auth/email-already-in-use") {
        msg = "This email is already registered. Please sign in instead.";
      } else if (err?.code === "auth/invalid-email") {
        msg = "Please enter a valid email address.";
      } else if (err?.code === "auth/weak-password") {
        msg = "Password is too weak. Please use at least 6 characters.";
      } else if (err?.message) {
        msg = err.message;
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
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-guardian-accent to-guardian-safe flex items-center justify-center shadow-2xl mb-3">
            <Shield size={28} className="text-slate-950" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-guardian-text">Create Account</h1>
          <p className="text-xs text-guardian-muted mt-1 uppercase tracking-widest">RideGuardian AI</p>
        </div>

        {/* Card */}
        <div className="bg-guardian-card border border-guardian-border rounded-2xl p-6 shadow-2xl">

          {success ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-14 h-14 rounded-full bg-guardian-safe/10 border border-guardian-safe/30 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-guardian-safe" />
              </div>
              <div>
                <p className="font-bold text-guardian-text text-base">Account Created!</p>
                <p className="text-xs text-guardian-muted mt-1">Redirecting you to set up your profile...</p>
              </div>
              <div className="w-5 h-5 border-2 border-guardian-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h2 className="text-base font-bold text-guardian-text">Your details</h2>
                <p className="text-xs text-guardian-muted mt-0.5">Create your RideGuardian account</p>
              </div>

              {/* Error Banner */}
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-guardian-critical/10 border border-guardian-critical/30 text-xs text-guardian-critical">
                  {error}
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label htmlFor="reg-name" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Full Name</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-guardian-muted" />
                    <input
                      id="reg-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      placeholder="Your full name"
                      className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl pl-9 pr-4 py-3 text-sm text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="reg-email" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Email</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-guardian-muted" />
                    <input
                      id="reg-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl pl-9 pr-4 py-3 text-sm text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
                    />
                  </div>
                </div>

                {/* Mobile */}
                <div className="space-y-1.5">
                  <label htmlFor="reg-phone" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Mobile Number</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-guardian-muted" />
                    <input
                      id="reg-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl pl-9 pr-4 py-3 text-sm text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
                    />
                  </div>
                  <p className="text-[10px] text-guardian-muted">Used for SOS emergency contacts</p>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="reg-password" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-guardian-muted" />
                    <input
                      id="reg-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Min. 6 characters"
                      className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl pl-9 pr-10 py-3 text-sm text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-guardian-muted">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <label htmlFor="reg-confirm" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Confirm Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-guardian-muted" />
                    <input
                      id="reg-confirm"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Re-enter password"
                      className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl pl-9 pr-4 py-3 text-sm text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  id="btn-register-submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-guardian-accent to-blue-500 text-white font-bold text-sm shadow-lg transition hover:opacity-90 active:scale-95 disabled:opacity-50"
                >
                  {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                  {loading ? "Creating account..." : "Create Account"}
                  {!loading && <ArrowRight size={15} />}
                </button>
              </form>

              {/* Login Link */}
              <div className="mt-6 text-center text-xs text-guardian-muted">
                Already have an account?{" "}
                <Link href="/login" className="text-guardian-accent font-bold hover:underline">
                  Sign in
                </Link>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-[10px] text-guardian-muted/40 mt-8">
          RideGuardian AI • Solo Travel Sentinel
        </p>
      </div>
    </main>
  );
}
