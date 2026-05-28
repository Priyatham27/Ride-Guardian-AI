"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Plus, Trash2, ShieldCheck, User, Sun, Moon } from "lucide-react";

interface Contact {
  name: string;
  email: string;
  relationship: string;
}

export default function SettingsPage() {
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

  const [bikeType, setBikeType] = useState("adventure");
  const [tankCapacity, setTankCapacity] = useState(18.0);
  const [avgMileage, setAvgMileage] = useState(25.0);
  const [inactivityMin, setInactivityMin] = useState(1);
  const [contacts, setContacts] = useState<Contact[]>([
    { name: "Priya (Sister)", email: "priyathamprime7@gmail.com", relationship: "Sister" },
    { name: "Ravi (Friend)", email: "kotipallipriyatham85@gmail.com", relationship: "Friend" }
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load current settings from database on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const res = await fetch(`${apiUrl}/api/user/settings`);
        if (res.ok) {
          const data = await res.json();
          setBikeType(data.bike_type);
          setTankCapacity(data.tank_capacity_liters);
          setAvgMileage(data.avg_mileage_kmpl);
          setInactivityMin(data.inactivity_threshold_min);
          if (data.emergency_contacts && data.emergency_contacts.length > 0) {
            setContacts(data.emergency_contacts);
          }
        }
      } catch (err) {
        console.error("Could not fetch settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleAddContact = () => {
    setContacts([...contacts, { name: "", email: "", relationship: "Friend" }]);
  };

  const handleRemoveContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index));
  };

  const handleContactChange = (index: number, key: keyof Contact, value: string) => {
    const updated = [...contacts];
    updated[index] = { ...updated[index], [key]: value };
    setContacts(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/user/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bike_type: bikeType,
          tank_capacity_liters: Number(tankCapacity),
          avg_mileage_kmpl: Number(avgMileage),
          inactivity_threshold_min: Number(inactivityMin),
          emergency_contacts: contacts
        })
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert("Failed to save settings");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-guardian-bg text-guardian-text flex flex-col justify-center items-center max-w-md mx-auto text-center p-6">
        <div className="w-10 h-10 border-4 border-guardian-accent border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm text-guardian-muted">Loading settings profile...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-guardian-bg text-guardian-text px-4 py-8 max-w-md mx-auto flex flex-col justify-between">
      
      {/* Header */}
      <div>
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" id="btn-back-home-settings" className="p-2 rounded-lg bg-guardian-card border border-guardian-border text-guardian-muted hover:text-guardian-text transition">
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 id="app-heading" className="text-lg font-bold">Guardian Settings</h1>
              <span className="text-[10px] text-guardian-muted uppercase tracking-wider">Configure Safety Triggers</span>
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

        {/* Success message banner */}
        {saveSuccess && (
          <div className="mb-5 bg-guardian-safe/10 border border-guardian-safe/30 rounded-xl p-3.5 flex gap-2.5 text-xs text-guardian-safe animate-pulse-glow">
            <ShieldCheck size={16} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">Configuration Saved</span>
              <span className="text-[11px] text-slate-300">Rider profile and emergency triggers updated successfully.</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Vehicle Profile Section */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-bold text-guardian-muted uppercase tracking-wider mb-2">Motorcycle Profile</legend>
            
            <div className="space-y-1.5">
              <label htmlFor="settings-bike-type" className="block text-xs text-guardian-muted">Type</label>
              <select
                id="settings-bike-type"
                value={bikeType}
                onChange={(e) => setBikeType(e.target.value)}
                className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text focus:outline-none transition"
              >
                <option value="adventure">Adventure (Long Range)</option>
                <option value="cruiser">Cruiser (Highway)</option>
                <option value="commuter">Commuter (Urban)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="settings-tank" className="block text-xs text-guardian-muted">Tank Size (L)</label>
                <input
                  type="number"
                  id="settings-tank"
                  step="0.5"
                  value={tankCapacity}
                  onChange={(e) => setTankCapacity(Number(e.target.value))}
                  required
                  className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text focus:outline-none transition font-mono"
                />
              </div>
              
              <div className="space-y-1.5">
                <label htmlFor="settings-mileage" className="block text-xs text-guardian-muted font-sans">Mileage (km/L)</label>
                <input
                  type="number"
                  id="settings-mileage"
                  step="0.5"
                  value={avgMileage}
                  onChange={(e) => setAvgMileage(Number(e.target.value))}
                  required
                  className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text focus:outline-none transition font-mono"
                />
              </div>
            </div>
          </fieldset>

          {/* Incident Trigger Section */}
          <fieldset className="space-y-4 pt-2">
            <legend className="text-xs font-bold text-guardian-muted uppercase tracking-wider mb-2">SOS Safety Sentinel</legend>
            
            <div className="space-y-1.5">
              <label htmlFor="settings-inactivity" className="block text-xs text-guardian-muted">
                Inactivity Detection Timer
              </label>
              <select
                id="settings-inactivity"
                value={inactivityMin}
                onChange={(e) => setInactivityMin(Number(e.target.value))}
                className="w-full bg-guardian-card border border-guardian-border focus:border-guardian-accent rounded-xl px-4 py-3 text-sm text-guardian-text focus:outline-none transition font-mono"
              >
                <option value={1}>1 Minute (For Hackathon Demo)</option>
                <option value={5}>5 Minutes (Highway)</option>
                <option value={8}>8 Minutes (Default)</option>
                <option value={15}>15 Minutes (City)</option>
              </select>
              <span className="block text-[10px] text-guardian-muted mt-1 leading-relaxed">
                If GPS speed drops to 0 km/h and no motion is sensed for this duration, RideGuardian launches the check-in overlay.
              </span>
            </div>
          </fieldset>

          {/* Emergency Contacts Section */}
          <fieldset className="space-y-4 pt-2">
            <div className="flex justify-between items-center mb-2">
              <legend className="text-xs font-bold text-guardian-muted uppercase tracking-wider">Emergency SOS Contacts</legend>
              <button
                type="button"
                onClick={handleAddContact}
                id="btn-add-contact"
                className="flex items-center gap-1 text-[10px] text-guardian-accent font-bold uppercase hover:underline"
              >
                <Plus size={12} /> Add Contact
              </button>
            </div>

            <div className="space-y-3">
              {contacts.map((c, idx) => (
                <div key={idx} className="bg-guardian-card/40 border border-guardian-border/80 rounded-xl p-3.5 space-y-3 relative">
                  
                  {/* Delete Button */}
                  {contacts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveContact(idx)}
                      id={`btn-remove-contact-${idx}`}
                      className="absolute top-3.5 right-3.5 text-guardian-muted hover:text-guardian-critical transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-guardian-muted uppercase font-bold tracking-wider">Contact Name</label>
                      <input
                        type="text"
                        value={c.name}
                        onChange={(e) => handleContactChange(idx, "name", e.target.value)}
                        placeholder="e.g. Priya"
                        required
                        className="w-full bg-slate-900 border border-guardian-border focus:border-guardian-accent rounded-lg px-2.5 py-1.5 text-xs text-guardian-text focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-guardian-muted uppercase font-bold tracking-wider">Relationship</label>
                      <input
                        type="text"
                        value={c.relationship}
                        onChange={(e) => handleContactChange(idx, "relationship", e.target.value)}
                        placeholder="e.g. Sister"
                        required
                        className="w-full bg-slate-900 border border-guardian-border focus:border-guardian-accent rounded-lg px-2.5 py-1.5 text-xs text-guardian-text focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-guardian-muted uppercase font-bold tracking-wider block">Email Address (SOS Alert Target)</label>
                    <input
                      type="email"
                      value={c.email}
                      onChange={(e) => handleContactChange(idx, "email", e.target.value)}
                      placeholder="e.g. contact@example.com"
                      required
                      className="w-full bg-slate-900 border border-guardian-border focus:border-guardian-accent rounded-lg px-2.5 py-1.5 text-xs text-guardian-text focus:outline-none font-mono"
                    />
                  </div>

                </div>
              ))}
            </div>
          </fieldset>

          {/* Save Button */}
          <button
            type="submit"
            id="btn-save-settings"
            disabled={saving}
            className="w-full flex items-center justify-center gap-1.5 py-4 rounded-xl bg-guardian-safe hover:bg-emerald-500 text-slate-950 font-bold text-sm shadow-xl transition transform active:scale-95"
          >
            <Save size={16} />
            {saving ? "Saving Profile..." : "Save Configurations"}
          </button>

        </form>
      </div>

    </main>
  );
}
