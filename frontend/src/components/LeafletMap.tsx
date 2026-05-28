"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// Fix Leaflet container size and default zoom
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
    // Force Leaflet to recalculate container boundaries to prevent broken/blank tiles
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [center, zoom, map]);
  return null;
}

interface MapProps {
  path: [number, number, string, number][];
  segments: any[];
  safetyReport: any;
  currentCoords?: [number, number];
  fuelStations?: any[];
  nearestHospital?: any;
}

export default function LeafletMap({
  path,
  segments,
  safetyReport,
  currentCoords,
  fuelStations = [],
  nearestHospital
}: MapProps) {
  const [mapCenter, setMapCenter] = useState<[number, number]>([15.8281, 78.0373]); // Default to Kurnool (center of route)
  const [zoom, setZoom] = useState(7);
  const [isLight, setIsLight] = useState(false);

  // Monitor theme changes to toggle tile styles dynamically
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

  // Set map center to current position or path origin on load
  useEffect(() => {
    if (currentCoords) {
      setMapCenter(currentCoords);
      setZoom(11);
    } else if (path && path.length > 0) {
      const midPoint = path[Math.floor(path.length / 2)];
      setMapCenter([midPoint[0], midPoint[1]]);
    }
  }, [currentCoords, path]);

  // Create custom neon divIcons to avoid image loading issues
  const riderIcon = L.divIcon({
    html: `
      <div class="relative flex items-center justify-center w-6 h-6">
        <span class="absolute inline-flex w-full h-full rounded-full bg-guardian-accent opacity-75 animate-ping"></span>
        <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-guardian-accent border-2 border-slate-900"></span>
      </div>
    `,
    className: "custom-rider-icon",
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  const fuelIcon = L.divIcon({
    html: `
      <div class="flex items-center justify-center w-5 h-5 rounded-full bg-guardian-warning border border-slate-900 shadow-md">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3 text-slate-950">
          <path d="M3 22h12M4 2v20M14 2v20M4 6h10M14 8h3a3 3 0 0 1 3 3v5a2 2 0 0 1-2 2h-1M18 11v3"/>
        </svg>
      </div>
    `,
    className: "custom-fuel-icon",
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  const hospitalIcon = L.divIcon({
    html: `
      <div class="flex items-center justify-center w-6 h-6 rounded-full bg-guardian-critical border border-slate-900 shadow-lg animate-pulse-glow">
        <span class="text-white text-xs font-bold font-sans">+</span>
      </div>
    `,
    className: "custom-hospital-icon",
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  const startIcon = L.divIcon({
    html: `
      <div class="flex items-center justify-center w-4 h-4 rounded-full bg-guardian-text border-2 border-slate-900 shadow-md"></div>
    `,
    className: "custom-start-icon",
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  const endIcon = L.divIcon({
    html: `
      <div class="flex items-center justify-center w-6 h-6 rounded-full bg-guardian-safe border-2 border-slate-900 shadow-md">
        <span class="text-slate-950 text-[10px] font-bold">🏁</span>
      </div>
    `,
    className: "custom-end-icon",
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  // Render a list of polyline segments based on risk ratings
  const renderSegments = () => {
    if (!segments || segments.length === 0) return null;

    return segments.map((seg) => {
      // Find matching safety advisory to get color rating
      let color = "#2979FF"; // Default blue
      if (safetyReport && safetyReport.segment_advisories) {
        const adv = safetyReport.segment_advisories.find(
          (a: any) => a.segment_id === seg.id
        );
        if (adv) {
          if (adv.status === "Safe") color = "#00E676";      // Green
          if (adv.status === "Warning") color = "#FFA000";   // Amber
          if (adv.status === "Critical") color = "#FF1744";  // Red
        }
      }

      // Slice the coordinates belonging to this segment
      // Path coordinates format: [lat, lon, label, km_mark]
      const segPoints = path.filter(
        (pt) => pt[3] >= seg.start_km && pt[3] <= seg.end_km
      );
      
      const polyCoords = segPoints.map((pt) => [pt[0], pt[1]] as [number, number]);

      if (polyCoords.length < 2) return null;

      return (
        <Polyline
          key={seg.id}
          positions={polyCoords}
          pathOptions={{
            color: color,
            weight: 5,
            opacity: 0.85,
            lineCap: "round"
          }}
        >
          <Popup>
            <div className="p-1 font-sans text-xs">
              <p className="font-bold text-guardian-text">{seg.name}</p>
              <p className="text-guardian-muted mt-0.5">{seg.road_type} • Quality: {seg.road_quality}</p>
            </div>
          </Popup>
        </Polyline>
      );
    });
  };

  return (
    <div className="w-full h-full relative" id="map-container-root">
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={isLight 
            ? "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          }
          subdomains="abcd"
          maxZoom={20}
        />
        
        <MapController center={mapCenter} zoom={zoom} />
        
        {/* Render color coded risk segments */}
        {renderSegments()}

        {/* Start / End Markers */}
        {path && path.length > 0 && (
          <>
            <Marker position={[path[0][0], path[0][1]]} icon={startIcon}>
              <Popup><span className="font-bold">Origin:</span> {path[0][2]}</Popup>
            </Marker>
            <Marker position={[path[path.length - 1][0], path[path.length - 1][1]]} icon={endIcon}>
              <Popup><span className="font-bold">Destination:</span> {path[path.length - 1][2]}</Popup>
            </Marker>
          </>
        )}

        {/* Open Fuel Station Markers */}
        {fuelStations.map((st, idx) => {
          if (st.status !== "Open") return null;
          return (
            <Marker key={idx} position={[st.coords[0], st.coords[1]]} icon={fuelIcon}>
              <Popup>
                <div className="p-1 text-xs">
                  <p className="font-bold text-guardian-warning">⛽ {st.name}</p>
                  <p className="text-emerald-400 font-semibold">Status: Open 24/7</p>
                  <p className="text-slate-400 mt-0.5">KM Marker: {st.km_mark}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Active Emergency Hospital Marker */}
        {nearestHospital && nearestHospital.lat && (
          <Marker position={[nearestHospital.lat, nearestHospital.lon]} icon={hospitalIcon}>
            <Popup>
              <div className="p-1 text-xs">
                <p className="font-bold text-guardian-critical">🏥 Nearest Emergency Care</p>
                <p className="font-semibold text-slate-100">{nearestHospital.name}</p>
                <p className="text-guardian-muted mt-0.5">Phone: {nearestHospital.phone}</p>
                <p className="text-red-400 mt-1 font-medium">Distance: {nearestHospital.distance_km} km away</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Active Rider GPS coordinate */}
        {currentCoords && (
          <Marker position={currentCoords} icon={riderIcon}>
            <Popup>
              <div className="text-xs p-1">
                <p className="font-bold text-guardian-accent">👤 Arjun Prasad (Rider)</p>
                <p className="text-slate-400 mt-0.5">Coords: {currentCoords[0].toFixed(4)}, {currentCoords[1].toFixed(4)}</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
