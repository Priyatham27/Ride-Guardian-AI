"use client";

import React, { useEffect, useRef, useState } from "react";

interface MapProps {
  path: [number, number, string, number][]; // [lat, lon, label, km_mark]
  segments: any[];
  safetyReport: any;
  currentCoords?: [number, number];
  fuelStations?: any[];
  nearestHospital?: any;
  sessionKey?: string; // Force remount when a new ride session starts
}


// Global script loader to prevent duplicate script tags
let scriptLoadingPromise: Promise<void> | null = null;

declare var google: any;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (typeof google !== "undefined" && google?.maps) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

export default function GoogleMap({
  path,
  segments,
  safetyReport,
  currentCoords,
  fuelStations = [],
  nearestHospital,
  sessionKey
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [apiReady, setApiReady] = useState(false);
  const [isLight, setIsLight] = useState(false);

  // References to keep track of drawings to clear them on updates
  const polylinesRef = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "8430579c0575cde8259d1103";

  // Reset map when sessionKey changes (new ride session)
  useEffect(() => {
    if (sessionKey && map) {
      // Clear all overlays and destroy the map instance
      polylinesRef.current.forEach((p) => { try { p.setMap(null); } catch {} });
      polylinesRef.current = [];
      markersRef.current.forEach((m) => { try { m.setMap(null); } catch {} });
      markersRef.current = [];
      setMap(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);


  // 1. Load the script
  useEffect(() => {
    if (apiKey) {
      loadGoogleMapsScript(apiKey)
        .then(() => setApiReady(true))
        .catch((err) => console.error("Error loading Google Maps API script:", err));
    }
  }, [apiKey]);

  // 2. Track theme changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsLight(document.documentElement.classList.contains("light"));
      
      const observer = new MutationObserver(() => {
        setIsLight(document.documentElement.classList.contains("light"));
      });
      
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"]
      });
      
      return () => observer.disconnect();
    }
  }, []);

  // 3. Initialize Map Instance
  useEffect(() => {
    if (apiReady && mapContainerRef.current && !map) {
      // Default to Kurnool
      const centerCoords = path && path.length > 0 
        ? { lat: path[Math.floor(path.length / 2)][0], lng: path[Math.floor(path.length / 2)][1] }
        : { lat: 15.8281, lng: 78.0373 };

      const mapInstance = new google.maps.Map(mapContainerRef.current, {
        center: centerCoords,
        zoom: 7,
        mapId: mapId,
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        scaleControl: true,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: false
      });

      setMap(mapInstance);
    }
  }, [apiReady, map, path, mapId]);

  // 4. Update Map Drawings on props change
  useEffect(() => {
    if (!map) return;

    // Clear existing polylines
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    // Clear existing markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let hasCoords = false;

    // Draw route segments
    if (segments && segments.length > 0 && path && path.length > 0) {
      segments.forEach((seg, idx) => {
        // Color coding based on risk status
        let color = "#2979FF"; // Default blue
        if (safetyReport && safetyReport.segment_advisories) {
          const adv = safetyReport.segment_advisories.find(
            (a: any) => a.segment_id === seg.id
          );
          if (adv) {
            if (adv.status === "Safe") color = "#00E676";      // Neon green
            if (adv.status === "Warning") color = "#FFA000";   // Hot amber
            if (adv.status === "Critical") color = "#FF1744";  // SOS red
          }
        }

        // Get points within segment km range
        const segPoints = path.filter(
          (pt) => pt[3] >= seg.start_km && pt[3] <= seg.end_km
        );
        const polyPath = segPoints.map((pt) => {
          bounds.extend({ lat: pt[0], lng: pt[1] });
          hasCoords = true;
          return { lat: pt[0], lng: pt[1] };
        });

        if (polyPath.length >= 2) {
          const polyline = new google.maps.Polyline({
            path: polyPath,
            geodesic: true,
            strokeColor: color,
            strokeOpacity: 0.9,
            strokeWeight: 6,
            map: map
          });
          polylinesRef.current.push(polyline);
        }
      });
    }

    // Helper: Create custom markers
    const createCustomMarker = (lat: number, lng: number, title: string, contentHtml: string) => {
      // Check if AdvancedMarkerElement is supported and ready
      if (google.maps.marker?.AdvancedMarkerElement) {
        const div = document.createElement("div");
        div.innerHTML = contentHtml;
        const advancedMarker = new google.maps.marker.AdvancedMarkerElement({
          map: map,
          position: { lat, lng },
          title: title,
          content: div
        });
        markersRef.current.push(advancedMarker);
        return advancedMarker;
      } else {
        // Fallback to standard Marker with scaled text icon / pin if advanced markers fail
        const standardMarker = new google.maps.Marker({
          map: map,
          position: { lat, lng },
          title: title
        });
        markersRef.current.push(standardMarker);
        return standardMarker;
      }
    };

    // Draw Start / End Markers
    if (path && path.length > 0) {
      const startPt = path[0];
      const endPt = path[path.length - 1];

      // Start: Simple white-black ring
      createCustomMarker(
        startPt[0],
        startPt[1],
        `Start: ${startPt[2]}`,
        `<div style="width: 14px; height: 14px; background: #F8FAFC; border: 3px solid #0F172A; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.5);"></div>`
      );

      // End: Checkered flag dot
      createCustomMarker(
        endPt[0],
        endPt[1],
        `Destination: ${endPt[2]}`,
        `<div style="display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: #00E676; border: 2.5px solid #0F172A; border-radius: 50%; font-size: 11px; box-shadow: 0 3px 6px rgba(0,0,0,0.4);">🏁</div>`
      );
    }

    // Draw Fuel Station Markers
    (fuelStations || []).forEach((st) => {
      if (st.status === "Open") {
        createCustomMarker(
          st.coords[0],
          st.coords[1],
          `⛽ ${st.name}`,
          `<div style="display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: #FFA000; border: 2px solid #0F172A; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">
            <svg viewBox="0 0 24 24" fill="none" stroke="#0F172A" stroke-width="3" style="width: 12px; height: 12px;">
              <path d="M3 22h12M4 2v20M14 2v20M4 6h10M14 8h3a3 3 0 0 1 3 3v5a2 2 0 0 1-2 2h-1M18 11v3"/>
            </svg>
           </div>`
        );
      }
    });

    // Draw Nearest Hospital Marker
    if (nearestHospital && nearestHospital.lat) {
      createCustomMarker(
        nearestHospital.lat,
        nearestHospital.lon,
        `🏥 Hospital: ${nearestHospital.name}`,
        `<div style="display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; background: #FF1744; border: 2.5px solid #0F172A; border-radius: 50%; color: #FFFFFF; font-weight: 900; font-family: sans-serif; font-size: 14px; box-shadow: 0 4px 8px rgba(255,23,68,0.4); animation: pulse 1.5s infinite;">+</div>
         <style>
          @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,23,68,0.7); }
            70% { transform: scale(1.05); box-shadow: 0 0 0 8px rgba(255,23,68,0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,23,68,0); }
          }
         </style>`
      );
    }

    // Draw Active Rider GPS position
    if (currentCoords) {
      createCustomMarker(
        currentCoords[0],
        currentCoords[1],
        "Your Location",
        `<div style="position: relative; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px;">
            <div style="position: absolute; width: 20px; height: 20px; background: #2979FF; border-radius: 50%; opacity: 0.5; animation: ping 1.4s ease-out infinite;"></div>
            <div style="position: relative; width: 12px; height: 12px; background: #2979FF; border: 2px solid #F8FAFC; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.5);"></div>
         </div>
         <style>
          @keyframes ping {
            0% { transform: scale(0.6); opacity: 0.8; }
            100% { transform: scale(1.8); opacity: 0; }
          }
         </style>`
      );

      // Pan to follow the rider during active navigation
      map.panTo({ lat: currentCoords[0], lng: currentCoords[1] });
    } else if (hasCoords) {
      // First load: fit bounds to see whole route
      map.fitBounds(bounds);
      
      // Prevent over-zooming on single point routes
      const listener = google.maps.event.addListener(map, "bounds_changed", () => {
        if (map.getZoom()! > 16) map.setZoom(16);
        google.maps.event.removeListener(listener);
      });
    }

  }, [map, path, segments, safetyReport, fuelStations, nearestHospital, currentCoords]);

  return (
    <div className="w-full h-full relative">
      {!apiKey && (
        <div className="absolute inset-0 z-10 bg-guardian-card flex flex-col items-center justify-center text-center p-4">
          <p className="text-sm font-bold text-guardian-critical mb-1">Google Maps Key Missing</p>
          <p className="text-xs text-guardian-muted">Check your environmental configuration files.</p>
        </div>
      )}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full rounded-xl bg-guardian-bg"
        style={{ minHeight: "260px", width: "100%", height: "100%" }}
      />
    </div>
  );
}
