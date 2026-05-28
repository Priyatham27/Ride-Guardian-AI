"use client";

import dynamic from "next/dynamic";

const DynamicLeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-guardian-card border border-guardian-border rounded-xl flex flex-col items-center justify-center text-guardian-muted min-h-[300px]">
      <div className="w-10 h-10 border-4 border-guardian-accent border-t-transparent rounded-full animate-spin"></div>
      <span className="mt-3 text-sm font-medium">Loading satellite tracks & safety overlay...</span>
    </div>
  )
});

const DynamicGoogleMap = dynamic(() => import("./GoogleMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-guardian-card border border-guardian-border rounded-xl flex flex-col items-center justify-center text-guardian-muted min-h-[300px]">
      <div className="w-10 h-10 border-4 border-guardian-accent border-t-transparent rounded-full animate-spin"></div>
      <span className="mt-3 text-sm font-medium">Loading official Google satellite grid...</span>
    </div>
  )
});

interface MapProps {
  path: [number, number, string, number][];
  segments: any[];
  safetyReport: any;
  currentCoords?: [number, number];
  fuelStations?: any[];
  nearestHospital?: any;
}

export default function Map(props: MapProps) {
  const useGoogleMaps = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (useGoogleMaps) {
    return <DynamicGoogleMap {...props} />;
  }
  return <DynamicLeafletMap {...props} />;
}
