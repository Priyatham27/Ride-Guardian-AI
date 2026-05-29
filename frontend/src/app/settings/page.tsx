"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft, Save, Plus, Trash2, ShieldCheck, User,
  Sun, Moon, Bike, MapPin, Users, Phone, Mail
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Contact {
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

type TabKey = "profile" | "bike" | "places" | "contacts" | "safety";

export default function SettingsPage() {
  const { currentUser, refreshProfile } = useAuth();

  const [theme, setTheme] = useState("dark");
  const [activeTab, setActiveTab] = useState<TabKey>("profile");

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

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");

  // Bike fields
  const [bikeName, setBikeName] = useState("");
  const [bikeType, setBikeType] = useState("adventure");
  const [petrolType, setPetrolType] = useState("Petrol (Regular)");
  const [tankCapacity, setTankCapacity] = useState(15.0);
  const [avgMileage, setAvgMileage] = useState(25.0);

  // Safety
  const [inactivityMin, setInactivityMin] = useState(8);

  // Contacts
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Places
  const [places, setPlaces] = useState<FavouritePlace[]>([
    { label: "", address: "" },
    { label: "", address: "" },
    { label: "", address: "" },
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");

  // Load settings from backend
  useEffect(() => {
    async function loadSettings() {
      if (!currentUser) return;
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const uid = localStorage.getItem("firebase_uid");
        const res = await fetch(`${apiUrl}/api/user/settings?firebase_uid=${uid}`);
        if (res.ok) {
          const data = await res.json();
          setFullName(data.full_name || "");
          setEmail(data.email || "");
          setMobileNumber(data.mobile_number || "");
          setBikeName(data.bike_name || "");
          setBikeType(data.bike_type || "adventure");
          setPetrolType(data.petrol_type || "Petrol (Regular)");
          setTankCapacity(data.tank_capacity_liters || 15.0);
          setAvgMileage(data.avg_mileage_kmpl || 25.0);
          setInactivityMin(data.inactivity_threshold_min || 8);
          if (data.emergency_contacts?.length > 0) {
            setContacts(data.emergency_contacts);
          } else {
            setContacts([{ name: "", email: "", relationship: "Family" }]);
          }
          if (data.favourite_places?.length > 0) {
            // Pad to 3
            const pads: FavouritePlace[] = [...data.favourite_places];
            while (pads.length < 3) pads.push({ label: "", address: "" });
            setPlaces(pads.slice(0, 3));
          }
        }
      } catch (err) {
        console.error("Could not fetch settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [currentUser]);

  const handleAddContact = () => {
    if (contacts.length < 5) {
      setContacts([...contacts, { name: "", email: "", relationship: "Friend" }]);
    }
  };

  const handleRemoveContact = (index: number) => {
    if (contacts.length > 1) {
      setContacts(contacts.filter((_, i) => i !== index));
    }
  };

  const handleContactChange = (index: number, key: keyof Contact, value: string) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], [key]: value };
    setContacts(updated);
  };

  const handlePlaceChange = (idx: number, key: keyof FavouritePlace, val: string) => {
    const updated = [...places];
    updated[idx] = { ...updated[idx], [key]: val };
    setPlaces(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    setSaveSuccess(false);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const uid = localStorage.getItem("firebase_uid");

      const res = await fetch(`${apiUrl}/api/user/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firebase_uid: uid,
          full_name: fullName,
          email,
          mobile_number: mobileNumber,
          bike_name: bikeName,
          bike_type: bikeType,
          petrol_type: petrolType,
          tank_capacity_liters: Number(tankCapacity),
          avg_mileage_kmpl: Number(avgMileage),
          inactivity_threshold_min: Number(inactivityMin),
          emergency_contacts: contacts.filter(c => c.name && c.email),
          favourite_places: places.filter(p => p.address),
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        await refreshProfile();
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setError("Failed to save settings. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError("Error saving settings.");
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: TabKey; icon: React.ReactNode; label: string }[] = [
    { key: "profile", icon: <User size={13} />, label: "Profile" },
    { key: "bike", icon: <Bike size={13} />, label: "Bike" },
    { key: "places", icon: <MapPin size={13} />, label: "Places" },
    { key: "contacts", icon: <Users size={13} />, label: "Contacts" },
    { key: "safety", icon: <ShieldCheck size={13} />, label: "Safety" },
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-guardian-bg text-guardian-text flex flex-col justify-center items-center max-w-md mx-auto text-center p-6">
        <div className="w-10 h-10 border-4 border-guardian-accent border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-guardian-muted">Loading settings...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-guardian-bg text-guardian-text px-4 py-8 max-w-md mx-auto">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Link href="/" id="btn-back-home-settings" className="p-2 rounded-lg bg-guardian-card border border-guardian-border text-guardian-muted hover:text-guardian-text transition">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 id="settings-heading" className="text-lg font-bold text-guardian-text">Settings</h1>
            <span className="text-[10px] text-guardian-muted uppercase tracking-wider">Guardian Configuration</span>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          id="btn-toggle-theme"
          className="p-2 rounded-lg bg-guardian-card border border-guardian-border text-guardian-muted hover:text-guardian-accent transition focus:outline-none"
          aria-label="Toggle Theme"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Success Banner */}
      {saveSuccess && (
        <div className="mb-5 bg-guardian-safe/10 border border-guardian-safe/30 rounded-xl p-3.5 flex gap-2.5 text-xs text-guardian-safe animate-pulse-glow">
          <ShieldCheck size={16} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-0.5">Configuration Saved</span>
            <span className="text-[11px] text-guardian-muted">Your profile and emergency triggers updated successfully.</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-guardian-critical/10 border border-guardian-critical/30 text-xs text-guardian-critical">
          {error}
        </div>
      )}

      {/* Tab Nav */}
      <div className="flex gap-1 mb-5 bg-guardian-card border border-guardian-border rounded-xl p-1 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-bold whitespace-nowrap transition flex-1 justify-center ${
              activeTab === t.key
                ? "bg-guardian-accent text-white shadow"
                : "text-guardian-muted hover:text-guardian-text"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-5">

        {/* PROFILE TAB */}
        {activeTab === "profile" && (
          <div className="bg-guardian-card border border-guardian-border rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-guardian-text flex items-center gap-2"><User size={14} /> Personal Info</h2>

            <div className="space-y-1.5">
              <label htmlFor="settings-name" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <User size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-guardian-muted" />
                <input
                  id="settings-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl pl-9 pr-4 py-3 text-sm text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="settings-email" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-guardian-muted" />
                <input
                  id="settings-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl pl-9 pr-4 py-3 text-sm text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="settings-mobile" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Mobile Number</label>
              <div className="relative">
                <Phone size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-guardian-muted" />
                <input
                  id="settings-mobile"
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl pl-9 pr-4 py-3 text-sm text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
                />
              </div>
            </div>
          </div>
        )}

        {/* BIKE TAB */}
        {activeTab === "bike" && (
          <div className="bg-guardian-card border border-guardian-border rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-guardian-text flex items-center gap-2"><Bike size={14} /> Motorcycle Profile</h2>

            <div className="space-y-1.5">
              <label htmlFor="settings-bike-name" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Bike Name / Model</label>
              <input
                id="settings-bike-name"
                type="text"
                value={bikeName}
                onChange={(e) => setBikeName(e.target.value)}
                placeholder="e.g. Royal Enfield Himalayan 450"
                className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="settings-bike-type" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Bike Type</label>
              <select
                id="settings-bike-type"
                value={bikeType}
                onChange={(e) => setBikeType(e.target.value)}
                className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text focus:outline-none transition"
              >
                {BIKE_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="settings-petrol" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Fuel Type</label>
              <select
                id="settings-petrol"
                value={petrolType}
                onChange={(e) => setPetrolType(e.target.value)}
                className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text focus:outline-none transition"
              >
                {PETROL_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="settings-tank" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Tank Size (L)</label>
                <input
                  id="settings-tank"
                  type="number"
                  step="0.5"
                  value={tankCapacity}
                  onChange={(e) => setTankCapacity(Number(e.target.value))}
                  required
                  className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text focus:outline-none transition font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="settings-mileage" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">Mileage (km/L)</label>
                <input
                  id="settings-mileage"
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

        {/* PLACES TAB */}
        {activeTab === "places" && (
          <div className="bg-guardian-card border border-guardian-border rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-guardian-text flex items-center gap-2"><MapPin size={14} /> Favourite Places</h2>
              <p className="text-[11px] text-guardian-muted mt-0.5">Appear as quick-select in the Ride Planner</p>
            </div>

            {places.map((place, idx) => (
              <div key={idx} className="bg-guardian-bg border border-guardian-border/60 rounded-xl p-3.5 space-y-2">
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
                      placeholder="City or full address"
                      className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-lg px-3 py-2 text-xs text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CONTACTS TAB */}
        {activeTab === "contacts" && (
          <div className="bg-guardian-card border border-guardian-border rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-sm font-bold text-guardian-text flex items-center gap-2"><Users size={14} /> Emergency SOS Contacts</h2>
                <p className="text-[11px] text-guardian-muted mt-0.5">Notified immediately when SOS is triggered</p>
              </div>
              {contacts.length < 5 && (
                <button type="button" onClick={handleAddContact} id="btn-add-contact"
                  className="flex items-center gap-1 text-[10px] text-guardian-accent font-bold hover:underline">
                  <Plus size={11} /> Add
                </button>
              )}
            </div>

            {contacts.map((c, idx) => (
              <div key={idx} className="bg-guardian-bg border border-guardian-border/60 rounded-xl p-3.5 space-y-2.5 relative">
                {contacts.length > 1 && (
                  <button type="button" onClick={() => handleRemoveContact(idx)}
                    id={`btn-remove-contact-${idx}`}
                    className="absolute top-3 right-3 text-guardian-muted hover:text-guardian-critical transition">
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
                      placeholder="Contact name"
                      required
                      className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-lg px-2.5 py-1.5 text-xs text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-guardian-muted uppercase tracking-wider mb-1">Relationship</label>
                    <input
                      type="text"
                      value={c.relationship}
                      onChange={(e) => handleContactChange(idx, "relationship", e.target.value)}
                      placeholder="e.g. Sister"
                      required
                      className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-lg px-2.5 py-1.5 text-xs text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-guardian-muted uppercase tracking-wider mb-1">Email (SOS Alert Target)</label>
                  <input
                    type="email"
                    value={c.email}
                    onChange={(e) => handleContactChange(idx, "email", e.target.value)}
                    placeholder="contact@example.com"
                    required
                    className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-lg px-2.5 py-1.5 text-xs text-guardian-text placeholder:text-guardian-muted/50 focus:outline-none transition font-mono"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SAFETY TAB */}
        {activeTab === "safety" && (
          <div className="bg-guardian-card border border-guardian-border rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-guardian-text flex items-center gap-2"><ShieldCheck size={14} /> SOS Safety Sentinel</h2>
              <p className="text-[11px] text-guardian-muted mt-0.5">Configure inactivity detection threshold</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="settings-inactivity" className="block text-[11px] font-bold text-guardian-muted uppercase tracking-wider">
                Inactivity Detection Timer
              </label>
              <select
                id="settings-inactivity"
                value={inactivityMin}
                onChange={(e) => setInactivityMin(Number(e.target.value))}
                className="w-full bg-guardian-bg border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text focus:outline-none transition font-mono"
              >
                <option value={1}>1 Minute (Demo / Testing)</option>
                <option value={5}>5 Minutes (Highway)</option>
                <option value={8}>8 Minutes (Default)</option>
                <option value={15}>15 Minutes (City)</option>
              </select>
              <span className="block text-[10px] text-guardian-muted mt-1 leading-relaxed">
                If GPS speed drops to 0 km/h and no motion is sensed for this duration, RideGuardian launches the check-in overlay.
              </span>
            </div>
          </div>
        )}

        {/* Save Button */}
        <button
          type="submit"
          id="btn-save-settings"
          disabled={saving}
          className="w-full flex items-center justify-center gap-1.5 py-4 rounded-xl bg-guardian-safe hover:bg-emerald-500 text-slate-950 font-bold text-sm shadow-xl transition transform active:scale-95 disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </main>
  );
}
