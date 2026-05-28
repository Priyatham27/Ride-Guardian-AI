"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Compass, ShieldAlert, Thermometer, Droplet, Milestone } from "lucide-react";

export default function Planner() {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  
  // Set default departure to 11 PM tonight to trigger night-risk models
  const [departureTime, setDepartureTime] = useState(() => {
    const today = new Date();
    today.setHours(23, 0, 0, 0);
    // Format to yyyy-MM-ddTHH:mm
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const hours = String(today.getHours()).padStart(2, "0");
    const minutes = String(today.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });

  const [fuelCapacity, setFuelCapacity] = useState(18.0);
  const [bikeType, setBikeType] = useState("adventure");
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const loadingSteps = [
    "Receiving ride parameters & checking rider profile...",
    "Querying maps for coordinate geometries...",
    "Sampling weather alerts at projected waypoint ETAs...",
    "Cross-referencing highway fuel stations for gaps...",
    "Synthesizing road quality & night isolation risks...",
    "Drafting safety narratives with AI analyst..."
  ];

  // Animate the loading step texts
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoading && loadingStep < loadingSteps.length - 1) {
      timer = setTimeout(() => {
        setLoadingStep((prev) => prev + 1);
      }, 900);
    }
    return () => clearTimeout(timer);
  }, [isLoading, loadingStep]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoadingStep(0);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${apiUrl}/api/journey/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          destination,
          departure_time: departureTime,
          fuel_capacity: Number(fuelCapacity),
          bike_type: bikeType
        })
      });

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      const data = await response.json();
      
      // Delay slightly for the final step to be readable
      setTimeout(() => {
        router.push(`/report/${data.journey_id}`);
      }, 1000);

    } catch (err) {
      console.error(err);
      setIsLoading(false);
      alert("Error generating route safety analysis. Make sure the backend server is running.");
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-guardian-bg text-guardian-text px-6 flex flex-col justify-center items-center max-w-md mx-auto text-center">
        <div className="w-16 h-16 relative mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-guardian-border border-t-guardian-safe animate-spin"></div>
          <div className="absolute inset-2 bg-guardian-card rounded-full flex items-center justify-center">
            <Compass className="w-6 h-6 text-guardian-safe animate-pulse" />
          </div>
        </div>
        
        <h2 className="text-xl font-bold tracking-tight mb-2">Analyzing Route Safety</h2>
        <p className="text-xs text-guardian-muted uppercase tracking-wider mb-8">RideGuardian AI Analyst</p>
        
        {/* Animated Loading Log */}
        <div className="w-full bg-guardian-card border border-guardian-border rounded-xl p-4 glass-panel text-left space-y-2.5 max-w-sm">
          {loadingSteps.map((step, idx) => {
            const isCompleted = idx < loadingStep;
            const isActive = idx === loadingStep;
            return (
              <div
                key={idx}
                className={`text-xs flex items-center gap-2 transition-all duration-300 ${
                  isCompleted ? "text-guardian-safe" : (isActive ? "text-guardian-accent font-bold" : "text-guardian-muted/30")
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isCompleted ? "bg-guardian-safe" : (isActive ? "bg-guardian-accent animate-ping" : "bg-guardian-muted/30")
                }`}></span>
                <span>{step}</span>
              </div>
            );
          })}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-guardian-bg text-guardian-text px-4 py-8 max-w-md mx-auto flex flex-col">
      
      {/* Navigation Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" id="btn-back-home" className="p-2 rounded-lg bg-guardian-card border border-guardian-border text-guardian-muted hover:text-guardian-text transition">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-lg font-bold">Plan a Ride</h1>
          <span className="text-[10px] text-guardian-muted uppercase tracking-wider">Configure Safety Parameters</span>
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="space-y-5 flex-1">
        
        {/* Origin */}
        <div className="space-y-1.5">
          <label htmlFor="origin" className="block text-xs font-bold text-guardian-muted uppercase tracking-wider">Origin</label>
          <input
            type="text"
            id="origin"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            required
            className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text focus:outline-none transition"
          />
        </div>

        {/* Destination */}
        <div className="space-y-1.5">
          <label htmlFor="destination" className="block text-xs font-bold text-guardian-muted uppercase tracking-wider">Destination</label>
          <input
            type="text"
            id="destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            required
            className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text focus:outline-none transition"
          />
        </div>

        {/* Departure Time */}
        <div className="space-y-1.5">
          <label htmlFor="departure-time" className="block text-xs font-bold text-guardian-muted uppercase tracking-wider">Departure Time</label>
          <input
            type="datetime-local"
            id="departure-time"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            required
            className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text focus:outline-none transition font-mono"
          />
          <span className="block text-[10px] text-guardian-warning">
            ⚠️ Traveling late night triggers night isolation warnings.
          </span>
        </div>

        {/* Bike Details Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="fuel-capacity" className="block text-xs font-bold text-guardian-muted uppercase tracking-wider">Fuel Capacity (L)</label>
            <input
              type="number"
              id="fuel-capacity"
              step="0.5"
              value={fuelCapacity}
              onChange={(e) => setFuelCapacity(Number(e.target.value))}
              required
              className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text focus:outline-none transition font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="bike-type" className="block text-xs font-bold text-guardian-muted uppercase tracking-wider">Motorcycle Type</label>
            <select
              id="bike-type"
              value={bikeType}
              onChange={(e) => setBikeType(e.target.value)}
              className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text focus:outline-none transition"
            >
              <option value="adventure">Adventure (Long Range)</option>
              <option value="cruiser">Cruiser (Highway)</option>
              <option value="commuter">Commuter (Urban)</option>
            </select>
          </div>
        </div>

        {/* Safety Core Banner */}
        <div className="bg-slate-950/40 border border-guardian-border/60 rounded-xl p-4 flex gap-3 text-xs leading-relaxed">
          <ShieldAlert className="text-guardian-accent w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-0.5 text-guardian-text">Why RideGuardian Planning?</span>
            <span className="text-guardian-muted text-[11px]">
              It overlays weather forecast grids, maps road segment quality indices, and flags refueling gaps against your bike&apos;s range before you leave the garage.
            </span>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          id="btn-submit-analyze"
          className="w-full py-4 rounded-xl bg-guardian-safe hover:bg-emerald-500 text-slate-950 font-bold text-sm shadow-xl transition transform active:scale-95 mt-4"
        >
          Generate Safety Analysis
        </button>

      </form>
    </main>
  );
}
