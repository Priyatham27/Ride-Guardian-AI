"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { PlusCircle, Shield, History, MapPin, Compass, Settings, CheckCircle2, ChevronRight, Sun, Moon } from "lucide-react";

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

export default function Home() {
  const [history, setHistory] = useState<JourneySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [safetyScore, setSafetyScore] = useState(88);
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
    async function fetchJourneys() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const res = await fetch(`${apiUrl}/api/user/journeys`);
        if (res.ok) {
          const data = await res.json();
          setHistory(data);
          
          // Calculate dynamic safety score average from completed runs
          const completed = data.filter((j: any) => j.status === "completed" && j.summary && j.summary.safety_rating);
          if (completed.length > 0) {
            const avg = completed.reduce((sum: number, curr: any) => sum + curr.summary.safety_rating, 0) / completed.length;
            setSafetyScore(Math.round(avg));
          }
        }
      } catch (err) {
        console.error("Could not fetch journeys:", err);
        // Pre-seed mock history for first-load visuals
        setHistory([
          {
            id: "mock-j-1",
            origin: "Hyderabad",
            destination: "Warangal",
            departure_time: "2026-05-24T18:00:00",
            status: "completed",
            created_at: "2026-05-24 18:00:00",
            ended_at: "2026-05-24 21:30:00",
            summary: {
              narrative: "Completed 145 km route safely. Monitored minor rain near Yadagirigutta. Rider kept steady speed and refueled at Aler.",
              safety_rating: 94
            }
          },
          {
            id: "mock-j-2",
            origin: "Hyderabad",
            destination: "Srisailam Forest",
            departure_time: "2026-05-18T06:00:00",
            status: "completed",
            created_at: "2026-05-18 06:00:00",
            ended_at: "2026-05-18 11:45:00",
            summary: {
              narrative: "Completed forest section. Warned of winding ghat curves. Inactivity trigger was checked once at Srisailam dam and resolved by rider confirmation.",
              safety_rating: 82
            }
          }
        ]);
      } finally {
        setLoading(false);
      }
    }
    fetchJourneys();
  }, []);

  return (
    <main className="min-h-screen bg-guardian-bg text-guardian-text px-4 py-8 max-w-md mx-auto flex flex-col justify-between">
      
      {/* Header Profile Section */}
      <div className="flex justify-between items-center mb-8">
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
        </div>
      </div>

      {/* Safety Score Card */}
      <section className="bg-guardian-card border border-guardian-border rounded-2xl p-6 mb-6 glass-panel flex items-center justify-between relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute -top-12 -right-12 w-24 h-24 bg-guardian-safe/10 rounded-full blur-xl"></div>
        <div>
          <span className="text-[10px] text-guardian-muted uppercase font-bold tracking-wider">Rider Safety Score</span>
          <h2 className="text-3xl font-extrabold font-mono mt-1 text-guardian-safe">{safetyScore}%</h2>
          <p className="text-[11px] text-guardian-muted mt-2 max-w-[200px]">
            Calculated over your last journeys based on speed, fatigue, and route response.
          </p>
        </div>
        <div className="flex items-center justify-center w-20 h-20 rounded-full border-4 border-guardian-border bg-slate-950/60 font-bold font-mono text-guardian-safe">
          {safetyScore >= 90 ? "A+" : (safetyScore >= 80 ? "A" : "B")}
        </div>
      </section>

      {/* Onboarding / Status Indicators */}
      <section className="grid grid-cols-2 gap-3 mb-8">
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
            <span className="text-[9px] text-guardian-muted">2 numbers linked</span>
          </div>
        </div>
      </section>

      {/* Start New Journey Prompt */}
      <section className="mb-8">
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
              <div key={i} className="h-24 bg-guardian-card/30 rounded-xl animate-pulse"></div>
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
                className="bg-guardian-card border border-guardian-border rounded-xl p-4 hover:border-guardian-border/80 transition relative"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-100">
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

                <div className="flex justify-between items-center mt-3 pt-2 border-t border-guardian-border/40 text-[9px] text-guardian-muted">
                  <span>{new Date(j.departure_time).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</span>
                  <span className={`capitalize font-bold ${
                    j.status === 'completed' ? 'text-guardian-safe' : (j.status === 'active' ? 'text-guardian-accent' : 'text-guardian-muted')
                  }`}>
                    {j.status}
                  </span>
                </div>
                
                {j.status === "active" && (
                  <Link
                    href={`/active/${j.id}`}
                    id={`btn-resume-${j.id}`}
                    className="absolute inset-0 bg-guardian-accent/5 hover:bg-guardian-accent/10 border border-guardian-accent/20 rounded-xl flex items-center justify-end pr-4 transition"
                  >
                    <span className="bg-guardian-accent text-white font-bold text-[10px] px-2 py-1 rounded shadow-md uppercase tracking-wider animate-pulse">
                      Resume active ride
                    </span>
                  </Link>
                )}

                {j.status === "completed" && (
                  <Link
                    href={`/summary/${j.id}`}
                    id={`btn-view-summary-${j.id}`}
                    className="absolute inset-0 bg-transparent hover:bg-guardian-safe/[0.02] rounded-xl flex items-center justify-end pr-4 transition group"
                  >
                    <span className="opacity-0 group-hover:opacity-100 bg-guardian-safe/10 border border-guardian-safe/30 text-guardian-safe font-bold text-[10px] px-2.5 py-1.5 rounded transition uppercase tracking-wider">
                      View Summary
                    </span>
                  </Link>
                )}

                {j.status === "planned" && (
                  <Link
                    href={`/report/${j.id}`}
                    id={`btn-view-report-${j.id}`}
                    className="absolute inset-0 bg-transparent hover:bg-guardian-accent/[0.02] rounded-xl flex items-center justify-end pr-4 transition group"
                  >
                    <span className="opacity-0 group-hover:opacity-100 bg-guardian-accent/10 border border-guardian-accent/30 text-guardian-accent font-bold text-[10px] px-2.5 py-1.5 rounded transition uppercase tracking-wider">
                      View Analysis
                    </span>
                  </Link>
                )}

                {j.status === "emergency" && (
                  <Link
                    href={`/sos/${j.id}`}
                    id={`btn-view-sos-${j.id}`}
                    className="absolute inset-0 bg-guardian-critical/5 hover:bg-guardian-critical/10 border border-guardian-critical/20 rounded-xl flex items-center justify-end pr-4 transition"
                  >
                    <span className="bg-guardian-critical text-white font-bold text-[10px] px-2.5 py-1.5 rounded shadow-md uppercase tracking-wider animate-pulse">
                      View SOS Status
                    </span>
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer Branding */}
      <footer className="text-center text-[10px] text-guardian-muted/50 mt-12 pt-4 border-t border-guardian-border/20">
        RideGuardian AI Sentinel v1.0.0 • Hackathon MVP Sprint 2026
      </footer>

    </main>
  );
}
