"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, User, Bike, MapPin, Users, Plus, Trash2,
  ChevronRight, CheckCircle2, Save
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface EmergencyContact {
  name: string;
  email: string;
  relationship: string;
}

interface FavouritePlace {
  label: string;
  address: string;
}

const PETROL_TYPES = [
  "Petrol (Regular)",
  "Petrol (Premium/Speed)",
  "Diesel",
  "CNG",
];

const BIKE_TYPES = [
  { value: "adventure", label: "Adventure (Long Range)" },
  { value: "cruiser", label: "Cruiser (Highway)" },
  { value: "commuter", label: "Commuter (Urban)" },
  { value: "sport", label: "Sport / Naked" },
  { value: "tourer", label: "Tourer / GT" },
];

type Section = "profile" | "bike" | "places" | "contacts";

export default function OnboardingPage() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const [activeSection, setActiveSection] = useState<Section>("profile");

  // Profile
  const [fullName, setFullName] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("onboard_name") || "";
    return "";
  });

  // Bike details
  const [bikeName, setBikeName] = useState("");
  const [bikeType, setBikeType] = useState("adventure");
  const [petrolType, setPetrolType] = useState("Petrol (Regular)");
  const [tankCapacity, setTankCapacity] = useState(15.0);
  const [avgMileage, setAvgMileage] = useState(25.0);

  // Favourite places
  const [places, setPlaces] = useState<FavouritePlace[]>([
    { label: "Home", address: "" },
    { label: "Office", address: "" },
    { label: "", address: "" },
  ]);

  // Emergency contacts
  const [contacts, setContacts] = useState<EmergencyContact[]>([
    { name: "", email: "", relationship: "Family" },
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sections: { key: Section; icon: React.ReactNode; label: string; desc: string }[] = [
    { key: "profile", icon: <User size={16} />, label: "Profile", desc: "Your name & identity" },
    { key: "bike", icon: <Bike size={16} />, label: "Bike Details", desc: "Your motorcycle info" },
    { key: "places", icon: <MapPin size={16} />, label: "Favourite Places", desc: "Quick-access locations" },
    { key: "contacts", icon: <Users size={16} />, label: "Emergency Contacts", desc: "SOS alert recipients" },
  ];

  const sectionOrder: Section[] = ["profile", "bike", "places", "contacts"];
  const currentIdx = sectionOrder.indexOf(activeSection);

  function handleNextSection() {
    if (currentIdx < sectionOrder.length - 1) {
      setActiveSection(sectionOrder[currentIdx + 1]);
    }
  }

  function handlePlaceChange(idx: number, key: keyof FavouritePlace, val: string) {
    const updated = [...places];
    updated[idx] = { ...updated[idx], [key]: val };
    setPlaces(updated);
  }

  function handleContactChange(idx: number, key: keyof EmergencyContact, val: string) {
    const updated = [...contacts];
    updated[idx] = { ...updated[idx], [key]: val };
    setContacts(updated);
  }

  function addContact() {
    if (contacts.length < 5) {
      setContacts([...contacts, { name: "", email: "", relationship: "Friend" }]);
    }
  }

  function removeContact(idx: number) {
    if (contacts.length > 1) {
      setContacts(contacts.filter((_, i) => i !== idx));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validate at least 1 contact
    const validContacts = contacts.filter(c => c.name && c.email);
    if (validContacts.length === 0) {
      setError("Please add at least one emergency contact with name and email.");
      return;
    }

    setSaving(true);
    try {
      const uid = typeof window !== "undefined" ? localStorage.getItem("firebase_uid") : null;
      if (!uid) throw new Error("Not authenticated. Please login again.");

      const res = await fetch(`${apiUrl}/api/auth/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firebase_uid: uid,
          full_name: fullName,
          email: currentUser?.email || null,
          mobile_number: typeof window !== "undefined" ? localStorage.getItem("onboard_phone") : null,
          bike_name: bikeName,
          bike_type: bikeType,
          petrol_type: petrolType,
          tank_capacity_liters: Number(tankCapacity),
          avg_mileage_kmpl: Number(avgMileage),
          inactivity_threshold_min: 8,
          favourite_places: places.filter(p => p.address),
          emergency_contacts: validContacts,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to save profile");
      }

      router.push("/");
    } catch (err: any) {
      setError(err.message || "Could not save profile. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const isLastSection = activeSection === "contacts";

  return (
    <main className="min-h-screen bg-guardian-bg text-guardian-text px-4 py-8 max-w-md mx-auto">

      {/* Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-guardian-accent to-guardian-safe flex items-center justify-center shadow-xl mb-3">
          <Shield size={24} className="text-slate-950" />
        </div>
        <h1 className="text-xl font-extrabold">Set Up Your Profile</h1>
        <p className="text-xs text-guardian-muted mt-1">Complete your guardian profile to get started</p>
      </div>

      {/* Section Nav Pills */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        {sections.map((s, idx) => {
          const isActive = activeSection === s.key;
          const isDone = sectionOrder.indexOf(s.key) < currentIdx;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveSection(s.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition border ${
                isActive
                  ? "bg-guardian-accent text-white border-guardian-accent shadow"
                  : isDone
                  ? "bg-guardian-safe/10 text-guardian-safe border-guardian-safe/20"
                  : "bg-guardian-card text-guardian-muted border-guardian-border hover:border-guardian-muted"
              }`}
            >
              {isDone ? <CheckCircle2 size={12} /> : s.icon}
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-guardian-critical/10 border border-guardian-critical/30 text-xs text-guardian-critical">
          {error}
        </div>
      )}

      <form onSubmit={handleSave}>
        
        {/* PROFILE SECTION */}
        {activeSection === "profile" && (
          <div className="bg-guardian-card border border-guardian-border rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-guardian-text flex items-center gap-2"><User size={14} /> Personal Info</h2>
              <p className="text-[11px] text-guardian-muted mt-0.5">Your identity on the platform</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="onboard-name" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Full Name</label>
              <input
                id="onboard-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="e.g. Priyatham Kumar"
                className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
              />
            </div>
          </div>
        )}

        {/* BIKE SECTION */}
        {activeSection === "bike" && (
          <div className="bg-guardian-card border border-guardian-border rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-guardian-text flex items-center gap-2"><Bike size={14} /> Motorcycle Details</h2>
              <p className="text-[11px] text-guardian-muted mt-0.5">Your bike info powers fuel & range calculations</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="onboard-bike-name" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Bike Name / Model</label>
              <input
                id="onboard-bike-name"
                type="text"
                value={bikeName}
                onChange={(e) => setBikeName(e.target.value)}
                placeholder="e.g. Royal Enfield Himalayan 450"
                className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="onboard-bike-type" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Bike Type</label>
              <select
                id="onboard-bike-type"
                value={bikeType}
                onChange={(e) => setBikeType(e.target.value)}
                className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text focus:outline-none transition"
              >
                {BIKE_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="onboard-petrol" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Fuel Type</label>
              <select
                id="onboard-petrol"
                value={petrolType}
                onChange={(e) => setPetrolType(e.target.value)}
                className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text focus:outline-none transition"
              >
                {PETROL_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="onboard-tank" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Tank Size (L)</label>
                <input
                  id="onboard-tank"
                  type="number"
                  step="0.5"
                  value={tankCapacity}
                  onChange={(e) => setTankCapacity(Number(e.target.value))}
                  required
                  className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text focus:outline-none transition font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="onboard-mileage" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Mileage (km/L)</label>
                <input
                  id="onboard-mileage"
                  type="number"
                  step="0.5"
                  value={avgMileage}
                  onChange={(e) => setAvgMileage(Number(e.target.value))}
                  required
                  className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text focus:outline-none transition font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* PLACES SECTION */}
        {activeSection === "places" && (
          <div className="bg-guardian-card border border-guardian-border rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-guardian-text flex items-center gap-2"><MapPin size={14} /> Favourite Places</h2>
              <p className="text-[11px] text-guardian-muted mt-0.5">Saved as quick-select in the ride planner (optional)</p>
            </div>

            {places.map((place, idx) => (
              <div key={idx} className="space-y-2.5 bg-guardian-bg border border-guardian-border/60 rounded-xl p-3.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-guardian-muted uppercase tracking-wider mb-1">Label</label>
                    <input
                      type="text"
                      value={place.label}
                      onChange={(e) => handlePlaceChange(idx, "label", e.target.value)}
                      placeholder={idx === 0 ? "Home" : idx === 1 ? "Office" : "Custom"}
                      className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-lg px-3 py-2 text-xs text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-guardian-muted uppercase tracking-wider mb-1">Address</label>
                    <input
                      type="text"
                      value={place.address}
                      onChange={(e) => handlePlaceChange(idx, "address", e.target.value)}
                      placeholder="City, State or full address"
                      className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-lg px-3 py-2 text-xs text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CONTACTS SECTION */}
        {activeSection === "contacts" && (
          <div className="bg-guardian-card border border-guardian-border rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-sm font-bold text-guardian-text flex items-center gap-2"><Users size={14} /> Emergency Contacts</h2>
                <p className="text-[11px] text-guardian-muted mt-0.5">These people receive SOS alerts if you&apos;re in danger</p>
              </div>
              {contacts.length < 5 && (
                <button type="button" onClick={addContact} className="flex items-center gap-1 text-[10px] text-guardian-accent font-bold hover:underline">
                  <Plus size={11} /> Add
                </button>
              )}
            </div>

            {contacts.map((c, idx) => (
              <div key={idx} className="bg-guardian-bg border border-guardian-border/60 rounded-xl p-3.5 space-y-2.5 relative">
                {contacts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeContact(idx)}
                    className="absolute top-3 right-3 text-guardian-muted hover:text-guardian-critical transition"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-guardian-muted uppercase tracking-wider mb-1">Name</label>
                    <input
                      type="text"
                      value={c.name}
                      onChange={(e) => handleContactChange(idx, "name", e.target.value)}
                      required
                      placeholder="e.g. Priya"
                      className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-lg px-3 py-2 text-xs text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-guardian-muted uppercase tracking-wider mb-1">Relationship</label>
                    <input
                      type="text"
                      value={c.relationship}
                      onChange={(e) => handleContactChange(idx, "relationship", e.target.value)}
                      required
                      placeholder="e.g. Sister"
                      className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-lg px-3 py-2 text-xs text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-guardian-muted uppercase tracking-wider mb-1">Email (SOS Alert Target)</label>
                  <input
                    type="email"
                    value={c.email}
                    onChange={(e) => handleContactChange(idx, "email", e.target.value)}
                    required
                    placeholder="contact@example.com"
                    className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-lg px-3 py-2 text-xs text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition font-mono"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-3 mt-6">
          {currentIdx > 0 && (
            <button
              type="button"
              onClick={() => setActiveSection(sectionOrder[currentIdx - 1])}
              className="flex-1 py-3.5 rounded-xl border border-guardian-border text-guardian-muted font-bold text-sm hover:border-guardian-text hover:text-guardian-text transition"
            >
              Back
            </button>
          )}

          {!isLastSection ? (
            <button
              type="button"
              onClick={handleNextSection}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-guardian-accent text-white font-bold text-sm shadow-lg hover:opacity-90 transition active:scale-95"
            >
              Next <ChevronRight size={15} />
            </button>
          ) : (
            <button
              type="submit"
              id="btn-save-onboarding"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-guardian-safe to-emerald-400 text-slate-950 font-bold text-sm shadow-lg hover:opacity-90 transition active:scale-95 disabled:opacity-50"
            >
              {saving ? <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" /> : <Save size={15} />}
              {saving ? "Saving..." : "Complete Setup"}
            </button>
          )}
        </div>

        <p className="text-center text-[10px] text-guardian-muted mt-4">
          You can always edit these in Settings later
        </p>
      </form>
    </main>
  );
}
