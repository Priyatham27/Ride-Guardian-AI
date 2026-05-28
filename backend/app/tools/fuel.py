import os
import json
from app.config import GOOGLE_MAPS_API_KEY

# Seeded fuel stations along the Hyderabad to Tirupati route (distances from Hyderabad)
SEEDED_FUEL_STATIONS = [
    {"name": "HP Petrol Pump - Shadnagar", "km_mark": 52, "coords": [17.0750, 78.2100]},
    {"name": "Indian Oil Station - Jadcherla", "km_mark": 93, "coords": [16.7680, 78.1450]},
    {"name": "Bharat Petroleum - Pebbar", "km_mark": 158, "coords": [16.2320, 77.8900]},
    {"name": "HP Fuel Outlet - Kurnool Bypass", "km_mark": 212, "coords": [15.8290, 78.0380]},
    # Notice the large gap between Kurnool (212km) and Allagadda (354km) -> 142km gap!
    # (Pre-seeded Nandyal station is marked as "Closed at night / No stock" for demo risk escalation)
    {"name": "Nandyal Highway BPCL (Night Closed)", "km_mark": 298, "coords": [15.4850, 78.4840], "status": "closed_night"},
    {"name": "Indian Oil Corporation - Allagadda", "km_mark": 354, "coords": [15.1300, 78.5100]},
    {"name": "Reliance Petroleum - Mydukur", "km_mark": 388, "coords": [14.8820, 78.6020]},
    {"name": "HP Petrol Pump - Kadapa City Entrance", "km_mark": 428, "coords": [14.4750, 78.8280]},
    # Another gap of 92km between Kadapa (428km) and Kodur (520km)
    {"name": "Bharat Petroleum - Kodur Bypass", "km_mark": 520, "coords": [13.9490, 79.3520]},
    {"name": "Indian Oil - Renigunta", "km_mark": 552, "coords": [13.6400, 79.5180]},
    {"name": "HP Fuel - Tirupati Bypass", "km_mark": 560, "coords": [13.6290, 79.4200]}
]

def find_fuel_station_gaps(route_path, tank_range_km: float, max_allowed_gap_km: float = 80.0, departure_hour: int = 23):
    """
    Scans the route for fuel stations and flags critical gaps.
    Arguments:
      - route_path: path array containing waypoints with km indices
      - tank_range_km: Maximum distance the bike can travel on a full tank (e.g. capacity * mileage)
      - max_allowed_gap_km: Warning threshold for segment isolation
      - departure_hour: Hour of departure (influences night closure calculations)
    """
    import httpx
    
    dest_label = route_path[-1][2].lower() if len(route_path) > 0 else ""
    is_demo = "tirupati" in dest_label or "hyderabad" in dest_label
    
    stations = []
    
    # If Google Maps key is set and it's a custom route, search Google Places API dynamically
    if GOOGLE_MAPS_API_KEY and not is_demo:
        search_points = []
        path_len = len(route_path)
        if path_len > 3:
            search_points.append(route_path[0])
            search_points.append(route_path[path_len // 3])
            search_points.append(route_path[2 * path_len // 3])
            search_points.append(route_path[-1])
        else:
            search_points = route_path
            
        seen_names = set()
        for pt in search_points:
            lat, lon, _, km = pt
            try:
                url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={lat},{lon}&radius=30000&type=gas_station&key={GOOGLE_MAPS_API_KEY}"
                res = httpx.get(url, timeout=5.0)
                if res.status_code == 200:
                    results = res.json().get("results", [])
                    for place in results[:3]:
                        name = place.get("name")
                        if name not in seen_names:
                            seen_names.add(name)
                            p_lat = place["geometry"]["location"]["lat"]
                            p_lon = place["geometry"]["location"]["lng"]
                            
                            # Map to closest kilometer waypoint along route
                            closest_km = km
                            min_d = float("inf")
                            for rp in route_path:
                                d = ((rp[0] - p_lat)**2 + (rp[1] - p_lon)**2)**0.5
                                if d < min_d:
                                    min_d = d
                                    closest_km = rp[3]
                                    
                            # Check opening hours
                            open_now = place.get("opening_hours", {}).get("open_now", True)
                            stations.append({
                                "name": name,
                                "km_mark": closest_km,
                                "coords": [p_lat, p_lon],
                                "status": "Open" if open_now else "Closed"
                            })
            except Exception as e:
                print(f"Places API fuel error: {e}")
                
    # Fallback to seeded demo pumps if offline or demo route selected
    if not stations:
        for fs in SEEDED_FUEL_STATIONS:
            is_night = (departure_hour + int(fs["km_mark"] / 60)) % 24 in [23, 0, 1, 2, 3, 4, 5]
            status = "Open"
            if fs.get("status") == "closed_night" and is_night:
                status = "Closed (Night Hours)"
                
            stations.append({
                "name": fs["name"],
                "km_mark": fs["km_mark"],
                "coords": fs["coords"],
                "status": status
            })

    # Sort stations by distance along route
    stations.sort(key=lambda x: x["km_mark"])

    # Find gaps between active (Open) stations
    gaps = []
    active_stations = [s for s in stations if s["status"] == "Open"]
    
    # Add start of route
    prev_km = 0
    prev_station_name = "Start (Hyderabad)"
    
    for s in active_stations:
        gap_dist = s["km_mark"] - prev_km
        if gap_dist > max_allowed_gap_km or gap_dist > (tank_range_km * 0.8):
            gaps.append({
                "start_station": prev_station_name,
                "start_km": prev_km,
                "end_station": s["name"],
                "end_km": s["km_mark"],
                "gap_distance_km": gap_dist,
                "severity": "Critical" if gap_dist > tank_range_km else "Warning",
                "message": f"Long fuel gap of {gap_dist} km between {prev_station_name} and {s['name']}. "
                           f"Ensure your tank is fully refueled before entering this stretch."
            })
        prev_km = s["km_mark"]
        prev_station_name = s["name"]
        
    # Check gap to destination
    dest_km = route_path[-1][3] if len(route_path) > 0 else 560
    final_gap = dest_km - prev_km
    if final_gap > max_allowed_gap_km:
        gaps.append({
            "start_station": prev_station_name,
            "start_km": prev_km,
            "end_station": "Destination (Tirupati)",
            "end_km": dest_km,
            "gap_distance_km": final_gap,
            "severity": "Warning",
            "message": f"Fuel gap of {final_gap} km to destination. Secure fuel at {prev_station_name}."
        })

    return {
        "stations": stations,
        "critical_gaps": gaps
    }
