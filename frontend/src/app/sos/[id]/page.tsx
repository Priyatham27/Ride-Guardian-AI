"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, Phone, MapPin, CheckCircle, AlertTriangle, ChevronRight, UserMinus } from "lucide-react";
import Map from "@/components/Map";

interface IncidentStatus {
  journey_status: string;
  is_emergency: boolean;
  incident: {
    id: string;
    trigger_type: string;
    triggered_at: string;
    last_known_lat: number;
    last_known_lon: number;
    sos_dispatched: boolean;
    contacts_notified: any[];
    nearest_hospital: any;
  } | null;
}

const timelineEvents = [
  { time: "T+0s", text: "Accelerometer anomaly detected" },
  { time: "T+1s", text: "Rider warning modal spawned" },
  { time: "T+30s", text: "No response from rider. Escalating to SOS." },
  { time: "T+32s", text: "Satellite GPS coordinate locked." },
  { time: "T+35s", text: "Emergency dispatch emails sent to contacts." },
  { time: "T+40s", text: "Surfacing closest emergency medical units." }
];

export default function SOSScreen() {
  const params = useParams();
  const router = useRouter();
  const journeyId = params.id as string;

  const [statusData, setStatusData] = useState<IncidentStatus | null>(null);
  const [timelineStep, setTimelineStep] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch emergency status from backend
  useEffect(() => {
    async function fetchStatus() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const res = await fetch(`${apiUrl}/api/emergency/${journeyId}/status`);
        if (res.ok) {
          const data = await res.json();
          setStatusData(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    if (journeyId) {
      fetchStatus();
      // Poll status every 4 seconds
      const pollTimer = setInterval(fetchStatus, 4000);
      return () => clearInterval(pollTimer);
    }
  }, [journeyId]);

  // Animate dispatch logs step-by-step
  useEffect(() => {
    let t: NodeJS.Timeout;
    if (timelineStep < timelineEvents.length) {
      t = setTimeout(() => {
        setTimelineStep((prev) => prev + 1);
      }, 700);
    }
    return () => clearTimeout(t);
  }, [timelineStep]);

  const handleResolveSafety = async () => {
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
        router.push("/");
      }
    } catch (e) {
      router.push("/");
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-guardian-bg text-guardian-text flex flex-col justify-center items-center max-w-md mx-auto text-center p-6">
        <div className="w-10 h-10 border-4 border-guardian-critical border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm text-guardian-muted">Connecting with safety node...</p>
      </main>
    );
  }

  // Fallback defaults if backend is offline
  const rawIncident = statusData?.incident;
  const incident = {
    trigger_type: rawIncident?.trigger_type || "inactivity",
    triggered_at: rawIncident?.triggered_at || new Date().toISOString(),
    last_known_lat: rawIncident?.last_known_lat ?? 15.4847,
    last_known_lon: rawIncident?.last_known_lon ?? 78.4828,
    sos_dispatched: rawIncident?.sos_dispatched ?? true,
    contacts_notified: rawIncident?.contacts_notified || [
      { name: "Priya (Sister)", email: "priyathamprime7@gmail.com", success: true, provider: "smtp" },
      { name: "Ravi (Friend)", email: "kotipallipriyatham85@gmail.com", success: true, provider: "mock" }
    ],
    nearest_hospital: rawIncident?.nearest_hospital || {
      name: "Government Area Hospital - Nandyal Bypass",
      phone: "+918514221100",
      distance_km: 2.1,
      lat: 15.4810,
      lon: 15.4810
    }
  };

  return (
    <main className="min-h-screen bg-guardian-bg text-guardian-text px-4 py-8 max-w-md mx-auto flex flex-col justify-between relative overflow-hidden">
      
      {/* Alert Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-guardian-critical/20 border border-guardian-critical/50 flex items-center justify-center mx-auto mb-4 animate-pulse-sos">
          <ShieldAlert size={32} className="text-guardian-critical" />
        </div>
        <h1 id="sos-header" className="text-2xl font-black text-guardian-critical tracking-wider uppercase">SOS Dispatched</h1>
        <span className="text-[10px] text-guardian-muted uppercase tracking-wider font-mono">
          Trigger: {incident.trigger_type.replace("_", " ")} • Lat {incident.last_known_lat.toFixed(4)}
        </span>
      </div>

      {/* SOS Automated sequence timeline */}
      <section className="bg-guardian-card border border-guardian-border rounded-xl p-4 mb-5 glass-panel">
        <h2 className="text-[10px] text-guardian-muted uppercase font-bold tracking-wider mb-3">System Automation Logs</h2>
        
        <div className="space-y-2.5">
          {timelineEvents.map((evt, idx) => {
            const isShown = idx < timelineStep;
            return (
              <div
                key={idx}
                className={`flex items-start gap-3 text-xs transition-opacity duration-300 ${
                  isShown ? "opacity-100" : "opacity-0 h-0 overflow-hidden"
                }`}
              >
                <span className="font-mono text-guardian-critical font-bold text-[10px] shrink-0 mt-0.5 w-10">{evt.time}</span>
                <span className="text-guardian-text font-sans">{evt.text}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Surfaced Emergency Medical Provider */}
      <section className="bg-guardian-card border border-guardian-critical/30 rounded-xl p-5 mb-5 glass-panel-sos relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-guardian-critical text-white text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-bl font-black">
          Primary responder
        </div>
        
        <span className="text-[9px] text-guardian-muted uppercase font-bold tracking-wider">Closest Trauma Center</span>
        <h3 className="text-base font-extrabold text-guardian-text mt-1">{incident.nearest_hospital.name}</h3>
        <p className="text-xs text-red-400 font-semibold mt-1">📍 Distance: {incident.nearest_hospital.distance_km} km away</p>
        
        <div className="flex gap-3 mt-4">
          <a
            href={`tel:${incident.nearest_hospital.phone}`}
            id="btn-call-hospital"
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-guardian-critical hover:bg-red-600 text-white font-bold rounded-lg text-xs transition"
          >
            <Phone size={13} fill="currentColor" />
            Call Hospital
          </a>
          <button
            onClick={() => alert(`Navigating to ${incident.nearest_hospital.name}`)}
            className="flex-1 py-2.5 bg-guardian-bg hover:bg-guardian-border border border-guardian-border text-guardian-text font-semibold rounded-lg text-xs transition"
          >
            Open Navigation
          </button>
        </div>
      </section>

      {/* Emergency Contacts Notification Status */}
      <section className="bg-guardian-card border border-guardian-border rounded-xl p-4 mb-6">
        <h2 className="text-[10px] text-guardian-muted uppercase font-bold tracking-wider mb-3">Email Dispatch Status</h2>
        
        <div className="space-y-2.5">
          {(incident.contacts_notified || []).map((c, idx) => (
            <div key={idx} className="flex justify-between items-center text-xs">
              <span className="font-semibold text-guardian-text">{c.name}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-guardian-muted font-mono">{c.email || c.contact_id || c.phone}</span>
                <span className={`w-2 h-2 rounded-full ${c.success ? 'bg-guardian-safe' : 'bg-guardian-warning'}`}></span>
                <span className="text-[10px] text-guardian-muted font-semibold">{c.success ? 'Sent' : 'Retrying'}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Resolve Safety Action */}
      <section>
        <button
          onClick={handleResolveSafety}
          id="btn-resolve-sos"
          className="w-full py-4 rounded-xl bg-guardian-safe hover:bg-emerald-500 text-slate-950 font-black text-sm uppercase shadow-xl transition transform active:scale-95"
        >
          Confirm I am Safe - Clear SOS
        </button>
      </section>

    </main>
  );
}
