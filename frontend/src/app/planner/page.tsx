"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Compass, ShieldAlert, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface FavouritePlace {
  label: string;
  address: string;
}

const loadingSteps = [
  "Receiving ride parameters & checking rider profile...",
  "Querying maps for coordinate geometries...",
  "Sampling weather alerts at projected waypoint ETAs...",
  "Cross-referencing highway fuel stations for gaps...",
  "Synthesizing road quality & night isolation risks...",
  "Drafting safety narratives with AI analyst...",
];

export default function Planner() {
  const router = useRouter();
  const { currentUser } = useAuth();

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");

  const [departureTime, setDepartureTime] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });

  const [fuelCapacity, setFuelCapacity] = useState(15.0);
  const [bikeType, setBikeType] = useState("adventure");
  const [favouritePlaces, setFavouritePlaces] = useState<FavouritePlace[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Load bike settings from backend
  useEffect(() => {
    if (!currentUser) return;
    async function loadSettings() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const uid = localStorage.getItem("firebase_uid");
        const res = await fetch(`${apiUrl}/api/user/settings?firebase_uid=${uid}`);
        if (res.ok) {
          const data = await res.json();
          setFuelCapacity(data.tank_capacity_liters || 15.0);
          setBikeType(data.bike_type || "adventure");
          if (data.favourite_places?.length > 0) {
            setFavouritePlaces(data.favourite_places.filter((p: FavouritePlace) => p.address));
          }
        }
      } catch (err) {
        console.error("Could not load settings:", err);
      } finally {
        setSettingsLoading(false);
      }
    }
    loadSettings();
  }, [currentUser]);

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
      const uid = localStorage.getItem("firebase_uid");
      const response = await fetch(`${apiUrl}/api/journey/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          destination,
          departure_time: departureTime,
          fuel_capacity: Number(fuelCapacity),
          bike_type: bikeType,
          firebase_uid: uid,
        }),
      });

      if (!response.ok) throw new Error("Analysis failed");

      const data = await response.json();
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
          <div className="absolute inset-0 rounded-full border-4 border-guardian-border border-t-guardian-safe animate-spin" />
          <div className="absolute inset-2 bg-guardian-card rounded-full flex items-center justify-center">
            <Compass className="w-6 h-6 text-guardian-safe animate-pulse" />
          </div>
        </div>

        <h2 className="text-xl font-bold tracking-tight mb-2">Analyzing Route Safety</h2>
        <p className="text-xs text-guardian-muted uppercase tracking-wider mb-8">RideGuardian AI Analyst</p>

        <div className="w-full bg-guardian-card border border-guardian-border rounded-xl p-4 glass-panel text-left space-y-2.5 max-w-sm">
          {loadingSteps.map((step, idx) => {
            const isCompleted = idx < loadingStep;
            const isActive = idx === loadingStep;
            return (
              <div
                key={idx}
                className={`text-xs flex items-center gap-2 transition-all duration-300 ${
                  isCompleted
                    ? "text-guardian-safe"
                    : isActive
                    ? "text-guardian-accent font-bold"
                    : "text-guardian-muted/30"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  isCompleted ? "bg-guardian-safe" : isActive ? "bg-guardian-accent animate-ping" : "bg-guardian-muted/30"
                }`} />
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
          <h1 className="text-lg font-bold text-guardian-text">Plan a Ride</h1>
          <span className="text-[10px] text-guardian-muted uppercase tracking-wider">Configure Safety Parameters</span>
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="space-y-5 flex-1">

        {/* Favourite Places Quick Select */}
        {favouritePlaces.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-guardian-muted uppercase tracking-wider flex items-center gap-1">
              <MapPin size={10} /> Favourite Places
            </p>
            <div className="flex flex-wrap gap-2">
              {favouritePlaces.map((place, idx) => (
                <div key={idx} className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setOrigin(place.address)}
                    className="px-2.5 py-1.5 rounded-lg bg-guardian-card border border-guardian-border text-[10px] font-bold text-guardian-muted hover:border-guardian-accent hover:text-guardian-accent transition"
                    title={`Set as origin: ${place.address}`}
                  >
                    From: {place.label || place.address}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDestination(place.address)}
                    className="px-2.5 py-1.5 rounded-lg bg-guardian-card border border-guardian-border text-[10px] font-bold text-guardian-muted hover:border-guardian-safe hover:text-guardian-safe transition"
                    title={`Set as destination: ${place.address}`}
                  >
                    To: {place.label || place.address}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Origin */}
        <div className="space-y-1.5">
          <label htmlFor="origin" className="block text-xs font-bold text-guardian-muted uppercase tracking-wider">Origin</label>
          <input
            type="text"
            id="origin"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            required
            placeholder="Where are you starting from?"
            className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
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
            placeholder="Where are you headed?"
            className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
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

        {/* Bike Details — pre-filled from settings */}
        {!settingsLoading && (
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
                <option value="adventure">Adventure</option>
                <option value="cruiser">Cruiser</option>
                <option value="commuter">Commuter</option>
                <option value="sport">Sport</option>
                <option value="tourer">Tourer</option>
              </select>
            </div>
          </div>
        )}

        {/* Safety Core Banner */}
        <div className="bg-guardian-card/40 border border-guardian-border/60 rounded-xl p-4 flex gap-3 text-xs leading-relaxed">
          <ShieldAlert className="text-guardian-accent w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-0.5 text-guardian-text">Why RideGuardian Planning?</span>
            <span className="text-guardian-muted text-[11px]">
              Overlays weather forecasts, maps road quality indices, and flags refueling gaps against your bike&apos;s range before you leave.
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
