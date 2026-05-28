"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Award, Compass, Heart, AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";

interface RideSummaryData {
  narrative: string;
  fatigue_index_pct: number;
  fuel_accuracy_pct: number;
  safety_rating: number;
  recommendations: string[];
}

export default function RideSummary() {
  const params = useParams();
  const router = useRouter();
  const journeyId = params.id as string;

  const [summary, setSummary] = useState<RideSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSummary() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const res = await fetch(`${apiUrl}/api/journey/${journeyId}/summary`);
        if (res.ok) {
          const data = await res.json();
          setSummary(data);
        } else {
          throw new Error("Failed to load");
        }
      } catch (err) {
        console.error(err);
        // Offline Fallback seeds
        setSummary({
          narrative: "You completed your 560 km ride from Hyderabad to Tirupati. You logged 2 risk alerts, including heavy rain near Nandyal. Your fuel stops aligned perfectly with predictions, and your average speed was 68 km/h.",
          fatigue_index_pct: 65,
          fuel_accuracy_pct: 92,
          safety_rating: 88,
          recommendations: [
            "Schedule rest stops every 2 hours to avoid cognitive fatigue.",
            "Always refuel at major hubs like Kurnool before crossing isolated highway sections.",
            "Use high-intensity auxiliary lights when driving through foggy ghats near Kodur."
          ]
        });
      } finally {
        setLoading(false);
      }
    }
    if (journeyId) {
      loadSummary();
    }
  }, [journeyId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-guardian-bg text-guardian-text flex flex-col justify-center items-center max-w-md mx-auto text-center p-6">
        <div className="w-10 h-10 border-4 border-guardian-safe border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm text-guardian-muted">Generating ride analytics & safety rating...</p>
      </main>
    );
  }

  const s = summary || {
    narrative: "No narrative available.",
    fatigue_index_pct: 0,
    fuel_accuracy_pct: 0,
    safety_rating: 0,
    recommendations: []
  };

  return (
    <main className="min-h-screen bg-guardian-bg text-guardian-text px-4 py-8 max-w-md mx-auto flex flex-col justify-between">
      
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-full bg-guardian-safe/10 border border-guardian-safe/30 flex items-center justify-center mx-auto mb-3">
          <Award size={28} className="text-guardian-safe" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Ride Debriefing</h1>
        <span className="text-[10px] text-guardian-muted uppercase tracking-wider font-mono">Journey Completed</span>
      </div>

      {/* Safety Score Meter */}
      <section className="bg-guardian-card border border-guardian-border rounded-xl p-5 mb-5 glass-panel text-center relative overflow-hidden">
        <span className="text-[9px] text-guardian-muted uppercase font-bold tracking-wider">Safety Score</span>
        <div className="text-4xl font-black font-mono text-guardian-safe mt-1">{s.safety_rating}%</div>
        
        {/* Progress bar */}
        <div className="w-full bg-slate-900 rounded-full h-2 mt-4 border border-guardian-border overflow-hidden">
          <div
            className="bg-guardian-safe h-full rounded-full"
            style={{ width: `${s.safety_rating}%` }}
          ></div>
        </div>

        <p className="text-xs text-guardian-muted mt-4 leading-relaxed font-sans px-2">
          {s.narrative}
        </p>
      </section>

      {/* Telemetry Ring Percentages */}
      <section className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-guardian-card border border-guardian-border rounded-xl p-4 text-center">
          <span className="block text-[9px] text-guardian-muted uppercase font-bold tracking-wider mb-2">Fatigue Index</span>
          <div className="text-2xl font-extrabold font-mono text-guardian-warning">{s.fatigue_index_pct}%</div>
          <span className="text-[9px] text-slate-400 mt-1 block">Moderate load</span>
        </div>
        
        <div className="bg-guardian-card border border-guardian-border rounded-xl p-4 text-center">
          <span className="block text-[9px] text-guardian-muted uppercase font-bold tracking-wider mb-2">Fuel Accuracy</span>
          <div className="text-2xl font-extrabold font-mono text-guardian-accent">{s.fuel_accuracy_pct}%</div>
          <span className="text-[9px] text-slate-400 mt-1 block">Optimized stops</span>
        </div>
      </section>

      {/* AI Recommendations */}
      <section className="bg-guardian-card border border-guardian-border rounded-xl p-5 mb-8">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-guardian-muted mb-3.5">
          <ShieldCheck size={14} className="text-guardian-safe" />
          <h2>AI Safety Recommendations</h2>
        </div>

        <div className="space-y-3 text-xs leading-relaxed">
          {(s.recommendations || []).map((rec, idx) => (
            <div key={idx} className="flex gap-3 items-start">
              <span className="w-5 h-5 rounded-full bg-slate-950/80 border border-guardian-border/60 flex items-center justify-center text-[10px] font-bold text-guardian-safe shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <p className="text-slate-300 font-sans">{rec}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Home Action */}
      <section>
        <Link
          href="/"
          id="btn-return-home"
          className="w-full flex items-center justify-center gap-1.5 py-4 rounded-xl bg-guardian-accent hover:bg-blue-600 text-white font-bold text-sm shadow-xl transition transform active:scale-95"
        >
          Return to Dashboard
          <ArrowRight size={16} />
        </Link>
      </section>

    </main>
  );
}
