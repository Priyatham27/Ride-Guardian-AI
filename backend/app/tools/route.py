import httpx
import json
import os
from app.config import GOOGLE_MAPS_API_KEY

# Pre-seeded route from Hyderabad to Tirupati via Kurnool, Nandyal, and Kadapa
# Contains coordinates, segment labels, distance metrics, and safety profiles.
PRE_SEEDED_ROUTE = {
    "origin": "Hyderabad",
    "destination": "Tirupati",
    "distance_km": 560,
    "duration_hours": 9.5,
    "path": [
        [17.3850, 78.4867, "Hyderabad (Start)", 0],
        [17.0722, 78.2062, "Shadnagar", 55],
        [16.7645, 78.1402, "Jadcherla", 95],
        [16.2307, 77.8924, "Pebbar", 160],
        [15.8281, 78.0373, "Kurnool (NH-44)", 210],
        [15.6500, 78.2500, "Orvakal", 240],
        [15.5200, 78.3800, "Panyam", 275],
        [15.4847, 78.4828, "Nandyal (NH-40)", 300],
        [15.2800, 78.5000, "Gaggalapalle (Forest border)", 335],
        [15.1322, 78.5085, "Allagadda", 355],
        [14.8800, 78.6000, "Mydukur", 390],
        [14.4712, 78.8252, "Kadapa (Cuddapah)", 430],
        [14.1866, 79.1601, "Rajampet", 485],
        [13.9482, 79.3510, "Kodur (Ghat segment)", 520],
        [13.6288, 79.4192, "Tirupati (End)", 560]
    ],
    # Segments dividing the route for risk calculations
    "segments": [
        {
            "id": "seg_hyd_kurnool",
            "name": "Hyderabad to Kurnool (NH-44)",
            "start_coords": [17.3850, 78.4867],
            "end_coords": [15.8281, 78.0373],
            "start_km": 0,
            "end_km": 210,
            "road_type": "4-Lane Highway",
            "road_quality": "Excellent",
            "isolation_index": "Low"
        },
        {
            "id": "seg_kurnool_nandyal",
            "name": "Kurnool to Nandyal (NH-40)",
            "start_coords": [15.8281, 78.0373],
            "end_coords": [15.4847, 78.4828],
            "start_km": 210,
            "end_km": 300,
            "road_type": "2-Lane Highway",
            "road_quality": "Average (Construction zones)",
            "isolation_index": "Medium"
        },
        {
            "id": "seg_nandyal_allagadda",
            "name": "Nandyal to Allagadda (NH-40 Forest Corridor)",
            "start_coords": [15.4847, 78.4828],
            "end_coords": [15.1322, 78.5085],
            "start_km": 300,
            "end_km": 355,
            "road_type": "2-Lane Remote Highway",
            "road_quality": "Poor (Potholes, isolated)",
            "isolation_index": "High"
        },
        {
            "id": "seg_allagadda_kadapa",
            "name": "Allagadda to Kadapa (NH-40)",
            "start_coords": [15.1322, 78.5085],
            "end_coords": [14.4712, 78.8252],
            "start_km": 355,
            "end_km": 430,
            "road_type": "4-Lane Highway",
            "road_quality": "Good",
            "isolation_index": "Low"
        },
        {
            "id": "seg_kadapa_tirupati",
            "name": "Kadapa to Tirupati (Ghat & Seshachalam Forest)",
            "start_coords": [14.4712, 78.8252],
            "end_coords": [13.6288, 79.4192],
            "start_km": 430,
            "end_km": 560,
            "road_type": "Winding Ghat Road",
            "road_quality": "Good (Sharp curves, wildlife crossing)",
            "isolation_index": "High"
        }
    ]
}

def analyze_route(origin: str, destination: str):
    """
    Queries Google Directions API if GOOGLE_MAPS_API_KEY is present,
    otherwise returns the pre-seeded Hyderabad to Tirupati data.
    """
    origin_clean = origin.strip().lower()
    dest_clean = destination.strip().lower()
    
    if not GOOGLE_MAPS_API_KEY:
        print("Warning: GOOGLE_MAPS_API_KEY is missing. Using pre-seeded route.")
        return PRE_SEEDED_ROUTE

    try:
        url = f"https://maps.googleapis.com/maps/api/directions/json?origin={origin_clean}&destination={dest_clean}&key={GOOGLE_MAPS_API_KEY}"
        
        response = httpx.get(url, timeout=10.0)
        if response.status_code != 200:
            raise Exception(f"Directions API failed with status {response.status_code}")
            
        data = response.json()
        if data.get("status") != "OK":
            raise Exception(f"Directions API returned status: {data.get('status')}")
            
        route = data["routes"][0]
        leg = route["legs"][0]
        distance_km = round(leg["distance"]["value"] / 1000.0)
        duration_hours = round(leg["duration"]["value"] / 3600.0, 1)
        
        steps = leg["steps"]
        path = []
        
        # Add starting point
        path.append([leg["start_location"]["lat"], leg["start_location"]["lng"], f"{origin} (Start)", 0])
        
        # Sample steps for waypoints
        import re
        step_interval = max(1, len(steps) // 12)
        accumulated_dist = 0.0
        
        for idx, step in enumerate(steps):
            accumulated_dist += step["distance"]["value"] / 1000.0
            if idx % step_interval == 0 or idx == len(steps) - 1:
                lat = step["end_location"]["lat"]
                lon = step["end_location"]["lng"]
                instr = step.get("html_instructions", "Highway Corridor")
                label = re.sub('<[^<]+?>', '', instr) # Clean HTML tags
                
                if len(label) > 28:
                    label = label[:25] + "..."
                    
                if idx == len(steps) - 1:
                    path.append([lat, lon, f"{destination} (End)", round(accumulated_dist)])
                else:
                    path.append([lat, lon, label, round(accumulated_dist)])
                    
        # Generate segments dynamically
        total_km = round(accumulated_dist)
        seg_size = total_km / 4
        segments = []
        
        for i in range(4):
            start_km = round(i * seg_size)
            end_km = round((i + 1) * seg_size) if i < 3 else total_km
            
            start_coords = [path[0][0], path[0][1]]
            end_coords = [path[-1][0], path[-1][1]]
            
            for pt in path:
                if abs(pt[3] - start_km) <= 15:
                    start_coords = [pt[0], pt[1]]
                if abs(pt[3] - end_km) <= 15:
                    end_coords = [pt[0], pt[1]]
                    
            segments.append({
                "id": f"seg_{i}",
                "name": f"Segment {i+1}: km {start_km} to {end_km}",
                "start_coords": start_coords,
                "end_coords": end_coords,
                "start_km": start_km,
                "end_km": end_km,
                "road_type": "National Highway" if i % 2 == 0 else "State Highway",
                "road_quality": "Good" if i % 2 == 0 else "Average",
                "isolation_index": "Low" if i < 2 else "Medium"
            })
            
        return {
            "origin": origin,
            "destination": destination,
            "distance_km": total_km,
            "duration_hours": duration_hours,
            "path": path,
            "segments": segments
        }
    except Exception as e:
        print(f"Error calling Maps API: {e}")
        raise e
