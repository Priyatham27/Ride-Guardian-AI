"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShieldAlert, AlertOctagon, HelpCircle, StopCircle, PlayCircle, ToggleLeft, ToggleRight, Sun, Moon } from "lucide-react";
import Map from "@/components/Map";
import CoPilotChat from "@/components/CoPilotChat";

interface RoutePoint {
  lat: number;
  lon: number;
  name: string;
  km: number;
}

export default function ActiveJourney() {
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

  const params = useParams();
  const router = useRouter();
  const journeyId = params.id as string;

  const [routeData, setRouteData] = useState<any>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentCoords, setCurrentCoords] = useState<[number, number]>([17.3850, 78.4867]);
  const [speed, setSpeed] = useState(0.0);
  const [fuelPct, setFuelPct] = useState(90);
  const [elapsedTime, setElapsedTime] = useState("0h 0m");
  const [currentSegment, setCurrentSegment] = useState("NH-44 Corridor");
  
  // Controls
  const [isSimulating, setIsSimulating] = useState(true);
  const [inactivityAlarm, setInactivityAlarm] = useState(false);
  const [alarmTimer, setAlarmTimer] = useState(30);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeAlert, setActiveAlert] = useState<string | null>(null);

  const simulationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const secondsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const alarmTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch route detail on load
  useEffect(() => {
    async function loadJourney() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const res = await fetch(`${apiUrl}/api/journey/${journeyId}/risk`);
        if (res.ok) {
          const data = await res.json();
          setRouteData(data.analysis);
          setOrigin(data.origin || "");
          setDestination(data.destination || "");
          if (data.analysis?.route_details?.path?.length > 0) {
            const startPt = data.analysis.route_details.path[0];
            setCurrentCoords([startPt[0], startPt[1]]);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    if (journeyId) {
      loadJourney();
    }
  }, [journeyId]);

  // Handle Elapsed time clock
  useEffect(() => {
    secondsTimerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        const hrs = Math.floor(next / 3600);
        const mins = Math.floor((next % 3600) / 60);
        setElapsedTime(`${hrs}h ${mins}m`);
        return next;
      });
    }, 1000);

    return () => {
      if (secondsTimerRef.current) clearInterval(secondsTimerRef.current);
    };
  }, []);

  // Handle GPS simulation progression
  useEffect(() => {
    if (isSimulating && routeData?.route_details?.path?.length > 0) {
      const path = routeData.route_details.path;
      
      simulationTimerRef.current = setInterval(async () => {
        setCurrentIdx((prevIdx) => {
          const nextIdx = (prevIdx + 1) % path.length;
          const nextPt = path[nextIdx];
          const nextCoords: [number, number] = [nextPt[0], nextPt[1]];
          
          setCurrentCoords(nextCoords);

          // Simulate Speed values (slowing down on ghats/forest corridors)
          let nextSpeed = 82.0;
          if (nextPt[2].includes("Ghat") || nextPt[2].includes("Forest")) {
            nextSpeed = 48.0;
          }
          if (nextIdx === path.length - 1) {
            nextSpeed = 0.0;
            setIsSimulating(false);
          }
          setSpeed(nextSpeed);

          // Deplete fuel based on distance
          const totalDist = routeData?.route_details?.distance_km || 1;
          const consumed = (nextPt[3] / totalDist) * 80;
          setFuelPct(max(10, round(90 - consumed)));

          // Track active segment description
          for (const seg of (routeData?.route_details?.segments || [])) {
            if (nextPt[3] >= seg?.start_km && nextPt[3] <= seg?.end_km) {
              setCurrentSegment(seg?.name);
            }
          }

          // Trigger context based warning notifications
          if (nextPt[3] === 210) {
            setActiveAlert("HP Refuel Advisory: Refuel completely at Kurnool. Next open pump is 142 km ahead.");
          } else if (nextPt[3] === 300) {
            setActiveAlert("Rain Corridor Warning: Entering wet forested segment. Traction reduced. Keep speed under 50 km/h.");
          } else if (nextPt[3] === 520) {
            setActiveAlert("Thick Fog Warning: Ghat section ahead. Visibility below 1.5km. Use fog lights.");
          } else {
            setActiveAlert(null);
          }

          // PATCH GPS location coordinates to backend
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
          fetch(`${apiUrl}/api/journey/${journeyId}/gps`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: nextPt[0],
              lon: nextPt[1],
              speed_kmh: nextSpeed
            })
          }).catch((e) => console.error("GPS Patch error:", e));

          return nextIdx;
        });
      }, 5000); // Advance waypoint coordinates every 5 seconds
    }

    return () => {
      if (simulationTimerRef.current) clearInterval(simulationTimerRef.current);
    };
  }, [isSimulating, routeData, journeyId]);

  // Handle Inactivity Alarm Countdown
  useEffect(() => {
    if (inactivityAlarm) {
      // Pause active movement
      setIsSimulating(false);
      setSpeed(0.0);
      
      alarmTimerRef.current = setInterval(() => {
        setAlarmTimer((prev) => {
          if (prev <= 1) {
            // Trigger emergency SOS endpoint in backend
            triggerSOS();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (alarmTimerRef.current) {
        clearInterval(alarmTimerRef.current);
      }
      setAlarmTimer(30);
    }

    return () => {
      if (alarmTimerRef.current) clearInterval(alarmTimerRef.current);
    };
  }, [inactivityAlarm]);

  const triggerSOS = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/emergency/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journey_id: journeyId,
          trigger_type: inactivityAlarm ? "inactivity" : "manual_sos",
          lat: currentCoords[0],
          lon: currentCoords[1]
        })
      });
      
      if (res.ok) {
        router.push(`/sos/${journeyId}`);
      }
    } catch (err) {
      console.error(err);
      router.push(`/sos/${journeyId}`); // client-side fallback
    }
  };

  const handleEndJourney = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/journey/${journeyId}/end`, {
        method: "POST"
      });
      if (res.ok) {
        router.push(`/summary/${journeyId}`);
      }
    } catch (err) {
      console.error(err);
      router.push(`/summary/${journeyId}`);
    }
  };

  return (
    <main className="min-h-screen bg-guardian-bg text-guardian-text px-4 py-6 max-w-md mx-auto flex flex-col justify-between">
      
      {/* active-cockpit HUD info */}
      <header className="flex justify-between items-center mb-4">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-guardian-safe animate-pulse"></span>
            <span className="text-xs font-bold text-slate-100 uppercase tracking-wide">Guardian HUD Active</span>
          </div>
          <span className="text-[9px] text-guardian-muted font-mono">{currentCoords[0].toFixed(5)}, {currentCoords[1].toFixed(5)}</span>
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
          <button
            onClick={handleEndJourney}
            id="btn-end-ride"
            className="flex items-center gap-1 text-[10px] uppercase font-bold border border-guardian-border bg-guardian-card px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-guardian-critical transition"
          >
            <StopCircle size={12} />
            End Ride
          </button>
        </div>
      </header>

      {/* Simulator Control Dock */}
      <section className="bg-slate-950/60 border border-guardian-border/80 rounded-xl p-3 mb-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            id="btn-toggle-sim"
            className="p-1 rounded bg-slate-900 border border-guardian-border hover:text-guardian-accent"
          >
            {isSimulating ? <StopCircle size={16} /> : <PlayCircle size={16} />}
          </button>
          <div>
            <span className="block text-[9px] text-guardian-muted font-bold uppercase">GPS Replayer</span>
            <span className="text-[10px] text-slate-300">
              {isSimulating ? `Moving (Waypoint ${currentIdx + 1}/${routeData?.route_details?.path?.length || 15})` : "Simulation Paused"}
            </span>
          </div>
        </div>

        <button
          onClick={() => setInactivityAlarm(!inactivityAlarm)}
          id="btn-sim-inactivity"
          className={`px-3 py-1.5 rounded-lg border font-bold text-[10px] uppercase transition ${
            inactivityAlarm 
              ? 'bg-guardian-warning/20 border-guardian-warning text-guardian-warning'
              : 'bg-slate-900 border-guardian-border hover:border-guardian-warning text-slate-400'
          }`}
        >
          🚨 Simulate Crash
        </button>
      </section>

      {/* active-warnings display banner */}
      {activeAlert && (
        <div className="mb-4 bg-guardian-warning/10 border border-guardian-warning/30 rounded-xl p-3.5 flex gap-3 text-xs leading-relaxed animate-pulse-glow">
          <AlertOctagon className="text-guardian-warning w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-guardian-warning block mb-0.5">Guardian Alerts Ticker</span>
            <span className="text-slate-200 text-[11px] font-medium">{activeAlert}</span>
          </div>
        </div>
      )}

      {/* Interactive Map */}
      <section className="h-[200px] w-full rounded-xl overflow-hidden border border-guardian-border mb-4 bg-guardian-card shadow-inner">
        {routeData && (
          <Map
            path={routeData?.route_details?.path || []}
            segments={routeData?.route_details?.segments || []}
            safetyReport={routeData?.safety_report}
            currentCoords={currentCoords}
            fuelStations={routeData?.fuel_stations || []}
          />
        )}
      </section>

      {/* Co-Pilot Chat Interface */}
      <section className="flex-1 min-h-[360px] flex flex-col mb-4">
        <CoPilotChat
          journeyId={journeyId}
          currentSpeed={speed}
          fuelPct={fuelPct}
          elapsedTime={elapsedTime}
          currentSegment={currentSegment}
          origin={origin}
          destination={destination}
        />
      </section>

      {/* SOS Quick Panic Panel */}
      <section>
        <button
          onClick={triggerSOS}
          id="btn-sos-panic"
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-guardian-critical text-white font-black text-sm uppercase shadow-xl border border-red-500/20 tracking-wider animate-pulse-sos hover:bg-red-600 transition"
        >
          <ShieldAlert size={18} />
          Emergency SOS Trigger
        </button>
      </section>

      {/* Inactivity Alarm Overlay Modal */}
      {inactivityAlarm && (
        <div className="fixed inset-0 z-[2000] bg-slate-950/90 backdrop-blur-md flex flex-col justify-center items-center p-6 text-center max-w-md mx-auto">
          <div className="w-20 h-20 bg-guardian-critical/10 border border-guardian-critical/30 rounded-full flex items-center justify-center mb-6 animate-pulse-sos">
            <ShieldAlert size={40} className="text-guardian-critical" />
          </div>
          <h2 className="text-2xl font-black text-guardian-critical uppercase tracking-wide mb-2">Are you okay?</h2>
          <p className="text-sm text-guardian-muted max-w-xs mb-8">
            RideGuardian detected no movement for over {routeData?.safety_report?.inactivity_threshold_min || 1} minute. SOS dispatch in:
          </p>

          <div className="w-24 h-24 rounded-full border-4 border-guardian-critical flex items-center justify-center font-mono text-3xl font-extrabold text-guardian-critical mb-10">
            {alarmTimer}s
          </div>

          <div className="space-y-4 w-full">
            <button
              onClick={() => setInactivityAlarm(false)}
              id="btn-confirm-ok"
              className="w-full py-4 bg-guardian-safe hover:bg-emerald-500 text-slate-950 font-bold rounded-xl text-sm transition"
            >
              I am OK - Dismiss Alert
            </button>
            <button
              onClick={triggerSOS}
              id="btn-confirm-sos"
              className="w-full py-3 bg-slate-900 border border-guardian-border hover:border-guardian-critical text-slate-400 font-bold rounded-xl text-xs uppercase"
            >
              Dispatch SOS Immediately
            </button>
          </div>
        </div>
      )}

    </main>
  );
}

// Helpers
function max(a: number, b: number) { return a > b ? a : b; }
function round(n: number) { return Math.round(n); }
