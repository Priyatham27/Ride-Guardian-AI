"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, ShieldCheck, Fuel, CloudSun, AlertTriangle, Info, Milestone } from "lucide-react";
import Map from "@/components/Map";

interface RouteAnalysis {
  journey_id: string;
  origin: string;
  destination: string;
  departure_time: string;
  status: string;
  analysis: {
    route_details: {
      distance_km: number;
      duration_hours: number;
      path: [number, number, string, number][];
      segments: any[];
    };
    weather_along_route: any[];
    fuel_stations: any[];
    fuel_gaps: any[];
    safety_report: {
      safety_score: number;
      ai_summary: string;
      segment_advisories: any[];
    };
  };
}

export default function Report() {
  const params = useParams();
  const router = useRouter();
  const journeyId = params.id as string;
  
  const [data, setData] = useState<RouteAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchReport() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const res = await fetch(`${apiUrl}/api/journey/${journeyId}/risk`);
        if (!res.ok) {
          throw new Error("Report not found");
        }
        const report = await res.json();
        setData(report);
      } catch (err) {
        console.error(err);
        setError("Could not load safety report. Ensure the backend server is running.");
      } finally {
        setLoading(false);
      }
    }
    if (journeyId) {
      fetchReport();
    }
  }, [journeyId]);

  const handleStartRide = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/journey/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journey_id: journeyId })
      });
      if (res.ok) {
        router.push(`/active/${journeyId}`);
      } else {
        alert("Failed to start journey");
      }
    } catch (err) {
      console.error(err);
      alert("Error starting ride");
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-guardian-bg text-guardian-text flex flex-col justify-center items-center max-w-md mx-auto text-center p-6">
        <div className="w-10 h-10 border-4 border-guardian-accent border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm text-guardian-muted">Retrieving compiled risk indices...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-guardian-bg text-guardian-text flex flex-col justify-center items-center max-w-md mx-auto p-6 text-center">
        <AlertTriangle className="text-guardian-critical w-12 h-12 mb-4" />
        <h2 className="text-lg font-bold mb-2">Error Loading Report</h2>
        <p className="text-xs text-guardian-muted mb-6">{error}</p>
        <Link href="/" className="px-4 py-2 bg-guardian-card border border-guardian-border rounded-lg text-sm">
          Go Back Home
        </Link>
      </main>
    );
  }

  const { analysis } = data;
  const safetyReport = analysis.safety_report;
  const route = analysis.route_details;

  return (
    <main className="min-h-screen bg-guardian-bg text-guardian-text px-4 py-8 max-w-md mx-auto flex flex-col">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/planner" id="btn-back-planner" className="p-2 rounded-lg bg-guardian-card border border-guardian-border text-guardian-muted hover:text-guardian-text transition">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-lg font-bold">Route Safety Profile</h1>
          <span className="text-[10px] text-guardian-muted uppercase tracking-wider">
            {data.origin} → {data.destination}
          </span>
        </div>
      </div>

      {/* Map Section */}
      <section className="h-[260px] w-full rounded-xl overflow-hidden border border-guardian-border mb-6 shadow-md bg-guardian-card relative">
        <Map
          path={route.path}
          segments={route.segments}
          safetyReport={safetyReport}
          fuelStations={analysis.fuel_stations}
        />
        {/* Distance Overlay Chip */}
        <div className="absolute top-3 left-3 bg-slate-950/90 border border-guardian-border px-3 py-1.5 rounded-lg text-[10px] font-bold z-[1000] flex gap-2">
          <span>📏 {route.distance_km} km</span>
          <span className="border-l border-guardian-border/60 pl-2">⏱️ {route.duration_hours} hrs</span>
        </div>
      </section>

      {/* Score and Overview */}
      <section className="bg-guardian-card border border-guardian-border rounded-xl p-5 mb-6 glass-panel relative overflow-hidden">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="text-[9px] text-guardian-muted uppercase font-bold tracking-wider">Safety Rating</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <h2 className="text-3xl font-extrabold font-mono text-guardian-accent">
                {safetyReport.safety_score}
              </h2>
              <span className="text-xs text-guardian-muted">/100</span>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
            safetyReport.safety_score >= 80 
              ? 'bg-guardian-safe/10 text-guardian-safe border-guardian-safe/30'
              : (safetyReport.safety_score >= 60 
                  ? 'bg-guardian-warning/10 text-guardian-warning border-guardian-warning/30'
                  : 'bg-guardian-critical/10 text-guardian-critical border-guardian-critical/30')
          }`}>
            {safetyReport.safety_score >= 80 ? "Low Risk" : (safetyReport.safety_score >= 60 ? "Moderate Risk" : "High Danger")}
          </div>
        </div>

        <div className="flex gap-2.5 items-start bg-slate-950/40 p-3 rounded-lg border border-guardian-border/40">
          <Info size={16} className="text-guardian-accent shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-guardian-text font-sans">
            {safetyReport.ai_summary}
          </p>
        </div>
      </section>

      {/* Critical Gaps Alerts */}
      {analysis.fuel_gaps && analysis.fuel_gaps.length > 0 && (
        <section className="mb-6 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-guardian-muted">
            <Fuel size={14} className="text-guardian-warning" />
            <h2>Critical Fuel Windows</h2>
          </div>
          {analysis.fuel_gaps.map((gap, idx) => (
            <div
              key={idx}
              className="bg-guardian-card border border-amber-500/20 rounded-xl p-4 flex gap-3 text-xs leading-relaxed"
            >
              <AlertTriangle className="text-guardian-warning w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-amber-400 mb-0.5">Refueling Gap: {gap.gap_distance_km} km</span>
                <p className="text-guardian-muted text-[11px]">
                  {gap.message}
                </p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Segment Advisories */}
      <section className="mb-8 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-guardian-muted">
          <Milestone size={14} className="text-guardian-accent" />
          <h2>Segment Analysis</h2>
        </div>
        
        <div className="space-y-2.5">
          {route.segments.map((seg, idx) => {
            const adv = safetyReport.segment_advisories.find(
              (a: any) => a.segment_id === seg.id
            );
            
            let statusColor = "text-guardian-accent";
            let borderStyle = "border-guardian-border";
            if (adv?.status === "Safe") {
              statusColor = "text-guardian-safe";
              borderStyle = "border-guardian-safe/20";
            }
            if (adv?.status === "Warning") {
              statusColor = "text-guardian-warning";
              borderStyle = "border-guardian-warning/20";
            }
            if (adv?.status === "Critical") {
              statusColor = "text-guardian-critical";
              borderStyle = "border-guardian-critical/20";
            }

            return (
              <div
                key={seg.id}
                className={`bg-guardian-card border ${borderStyle} rounded-xl p-4`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-xs font-bold text-guardian-text">{seg.name}</h3>
                    <span className="text-[9px] text-guardian-muted font-mono">{seg.road_type} • Quality: {seg.road_quality}</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-bold ${statusColor}`}>{adv?.status || "Unknown"}</span>
                    {adv?.score && <span className="block text-[8px] font-mono text-guardian-muted">Risk: {adv.score}/100</span>}
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-[10px] bg-guardian-bg/25 px-2.5 py-1.5 rounded-lg border border-guardian-border/30 mb-2 mt-3">
                  <span className="text-guardian-muted">Estimated Weather:</span>
                  <span className="text-guardian-text font-medium">☁️ {adv?.weather || "Checking..."}</span>
                </div>

                <p className="text-[11px] text-guardian-muted leading-relaxed font-sans pl-1 border-l-2 border-guardian-border/80">
                  {adv?.advisory || "Maintain standard highway driving safety rules."}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Start Ride Trigger */}
      <button
        onClick={handleStartRide}
        id="btn-confirm-start"
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-guardian-safe hover:bg-emerald-500 text-slate-950 font-bold text-sm shadow-xl transition transform active:scale-95"
      >
        <Play size={16} fill="currentColor" />
        Confirm Route & Start Journey
      </button>

    </main>
  );
}
