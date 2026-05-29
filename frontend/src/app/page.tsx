"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  PlusCircle, Shield, History, Settings, CheckCircle2,
  ChevronRight, Sun, Moon, LogOut, FileText
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface JourneySummary {
  id: string;
  origin: string;
  destination: string;
  departure_time: string;
  status: string;
  created_at: string;
  ended_at: string | null;
  summary: {
    narrative?: string;
    safety_rating?: number;
  };
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

export default function Home() {
  const { currentUser, userProfile, loading: authLoading, logout } = useAuth();
  const [history, setHistory] = useState<JourneySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [safetyScore, setSafetyScore] = useState<number | null>(null);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const activeTheme = localStorage.getItem("theme") || "dark";
      setTheme(activeTheme);
      if (activeTheme === "light") {
        document.documentElement.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
      }
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    async function fetchJourneys() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const uid = localStorage.getItem("firebase_uid");
        const res = await fetch(`${apiUrl}/api/user/journeys?firebase_uid=${uid}`);
        if (res.ok) {
          const data = await res.json();
          setHistory(Array.isArray(data) ? data : []);

          const completed = (Array.isArray(data) ? data : []).filter(
            (j: any) => j?.status === "completed" && j?.summary?.safety_rating
          );
          if (completed.length > 0) {
            const avg =
              completed.reduce(
                (sum: number, curr: any) => sum + (curr?.summary?.safety_rating || 0),
                0
              ) / completed.length;
            setSafetyScore(Math.round(avg));
          }
        }
      } catch (err) {
        console.error("Could not fetch journeys:", err);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    }
    fetchJourneys();
  }, [currentUser]);

  // Show a loading splash while auth resolves
  if (authLoading) {
    return (
      <main className="min-h-screen bg-guardian-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-guardian-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-guardian-muted">Loading Guardian...</p>
        </div>
      </main>
    );
  }

  const displayName = userProfile?.full_name || currentUser?.displayName || "Rider";
  const firstName = displayName.split(" ")[0];
  const greeting = getGreeting();

  // Emergency contacts count for status indicator
  const contactsCount = 0; // Will be updated from settings API if needed

  return (
    <main className="min-h-screen bg-guardian-bg text-guardian-text px-4 py-8 max-w-md mx-auto flex flex-col">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-guardian-accent to-guardian-safe flex items-center justify-center shadow-lg">
            <Shield size={16} className="text-slate-950" />
          </div>
          <div>
            <h1 id="app-heading" className="text-md font-bold tracking-tight font-sans">RideGuardian AI</h1>
            <span className="text-[10px] text-guardian-muted uppercase tracking-wider">Solo Travel Sentinel</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            id="btn-toggle-theme"
            className="p-2 rounded-lg bg-guardian-card border border-guardian-border text-guardian-muted hover:text-guardian-accent transition focus:outline-none"
            aria-label="Toggle Theme"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link href="/settings" id="btn-settings-nav" className="p-2 rounded-lg bg-guardian-card border border-guardian-border text-guardian-muted hover:text-guardian-accent transition">
            <Settings size={16} />
          </Link>
          <button
            type="button"
            onClick={logout}
            id="btn-logout"
            className="p-2 rounded-lg bg-guardian-card border border-guardian-border text-guardian-muted hover:text-guardian-critical transition"
            aria-label="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Greeting Banner */}
      <section className="mb-6">
        <div className="bg-gradient-to-r from-guardian-accent/10 to-guardian-safe/10 border border-guardian-accent/20 rounded-2xl px-5 py-4">
          <p className="text-xs text-guardian-muted font-medium uppercase tracking-wider mb-0.5">{greeting}</p>
          <h2 className="text-xl font-extrabold text-guardian-text tracking-tight">{firstName} 👋</h2>
          <p className="text-[11px] text-guardian-muted mt-1">Stay safe on every ride. Your guardian is active.</p>
        </div>
      </section>

      {/* Safety Score Card */}
      {safetyScore !== null && (
        <section className="bg-guardian-card border border-guardian-border rounded-2xl p-6 mb-5 glass-panel flex items-center justify-between relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-guardian-safe/10 rounded-full blur-xl" />
          <div>
            <span className="text-[10px] text-guardian-muted uppercase font-bold tracking-wider">Rider Safety Score</span>
            <p className="text-3xl font-extrabold font-mono mt-1 text-guardian-safe">{safetyScore}%</p>
            <p className="text-[11px] text-guardian-muted mt-2 max-w-[200px]">
              Calculated from your completed journeys based on speed, fatigue, and route response.
            </p>
          </div>
          <div className="flex items-center justify-center w-20 h-20 rounded-full border-4 border-guardian-border bg-slate-950/60 font-bold font-mono text-guardian-safe">
            {safetyScore >= 90 ? "A+" : safetyScore >= 80 ? "A" : "B"}
          </div>
        </section>
      )}

      {/* Status Indicators */}
      <section className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-guardian-card/40 border border-guardian-border/60 rounded-xl p-3.5 flex items-center gap-2.5">
          <CheckCircle2 size={16} className="text-guardian-safe" />
          <div>
            <span className="block text-[10px] font-bold text-guardian-text">GPS Lock</span>
            <span className="text-[9px] text-guardian-muted">Satellite ready</span>
          </div>
        </div>
        <div className="bg-guardian-card/40 border border-guardian-border/60 rounded-xl p-3.5 flex items-center gap-2.5">
          <CheckCircle2 size={16} className="text-guardian-safe" />
          <div>
            <span className="block text-[10px] font-bold text-guardian-text">SOS Contacts</span>
            <span className="text-[9px] text-guardian-muted">Emergency setup</span>
          </div>
        </div>
      </section>

      {/* Start New Journey */}
      <section className="mb-6">
        <Link
          href="/planner"
          id="btn-start-ride"
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-guardian-accent to-blue-600 hover:from-blue-600 hover:to-guardian-accent text-white font-bold text-sm shadow-xl transition transform active:scale-95"
        >
          <PlusCircle size={18} />
          Start a Safety Journey
        </Link>
      </section>

      {/* Ride History */}
      <section className="flex-1">
        <div className="flex items-center gap-1.5 mb-4 text-xs font-bold uppercase tracking-wider text-guardian-muted">
          <History size={13} />
          <h2>Ride Safety Log</h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 bg-guardian-card/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="bg-guardian-card/20 border border-guardian-border/40 border-dashed rounded-xl p-8 text-center text-guardian-muted text-xs">
            No journeys completed yet. Start your first journey to begin safety logging.
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((j) => (
              <div
                key={j.id}
                className="bg-guardian-card border border-guardian-border rounded-xl p-4 hover:border-guardian-border/80 transition"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-1 text-xs font-bold text-guardian-text">
                    <span>{j.origin}</span>
                    <ChevronRight size={12} className="text-guardian-muted" />
                    <span>{j.destination}</span>
                  </div>
                  {j.summary?.safety_rating && (
                    <span className="text-[10px] font-mono font-bold bg-guardian-safe/10 text-guardian-safe px-2 py-0.5 rounded border border-guardian-safe/20">
                      {j.summary.safety_rating}%
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-guardian-muted line-clamp-2 leading-relaxed">
                  {j.summary?.narrative || "Pre-ride risk report analyzed. Journey record created."}
                </p>

                <div className="flex justify-between items-center mt-3 pt-2 border-t border-guardian-border/40">
                  <span className="text-[9px] text-guardian-muted">
                    {new Date(j.departure_time).toLocaleDateString(undefined, {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </span>
                  <span className={`text-[9px] capitalize font-bold ${
                    j.status === "completed" ? "text-guardian-safe"
                    : j.status === "active" ? "text-guardian-accent"
                    : "text-guardian-muted"
                  }`}>
                    {j.status}
                  </span>
                </div>

                {/* Always-visible action buttons */}
                <div className="mt-3 flex gap-2">
                  {j.status === "active" && (
                    <Link
                      href={`/active/${j.id}`}
                      id={`btn-resume-${j.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-guardian-accent text-white font-bold text-[10px] uppercase tracking-wider animate-pulse shadow"
                    >
                      Resume Active Ride
                    </Link>
                  )}

                  {j.status === "completed" && (
                    <Link
                      href={`/summary/${j.id}`}
                      id={`btn-view-summary-${j.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-guardian-safe/10 border border-guardian-safe/30 text-guardian-safe font-bold text-[10px] uppercase tracking-wider hover:bg-guardian-safe/20 transition"
                    >
                      <FileText size={11} /> View Summary
                    </Link>
                  )}

                  {j.status === "planned" && (
                    <Link
                      href={`/report/${j.id}`}
                      id={`btn-view-report-${j.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-guardian-accent/10 border border-guardian-accent/30 text-guardian-accent font-bold text-[10px] uppercase tracking-wider hover:bg-guardian-accent/20 transition"
                    >
                      View Analysis
                    </Link>
                  )}

                  {j.status === "emergency" && (
                    <Link
                      href={`/sos/${j.id}`}
                      id={`btn-view-sos-${j.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-guardian-critical text-white font-bold text-[10px] uppercase tracking-wider animate-pulse shadow"
                    >
                      View SOS Status
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="text-center text-[10px] text-guardian-muted/50 mt-10 pt-4 border-t border-guardian-border/20">
        RideGuardian AI Sentinel v2.0 • Production Build
      </footer>
    </main>
  );
}
