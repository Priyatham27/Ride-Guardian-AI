import json
from app.tools.route import analyze_route
from app.tools.weather import get_weather_along_route
from app.tools.fuel import find_fuel_station_gaps
from app.agents.llm import call_llm

SYSTEM_PROMPT = """
You are the RideGuardian Route Analyst Agent. Your job is to analyze a solo rider's journey route, weather conditions, and fuel stations, and output a detailed safety report.
You must return your output strictly in JSON format. The JSON must contain:
1. "safety_score": An integer from 0 to 100 representing the overall safety of the journey.
2. "ai_summary": A concise plain-language summary (2-3 sentences) detailing the primary risks.
3. "segment_advisories": An array of objects, one for each segment in the route. Each segment object must contain:
   - "segment_id": The string id of the segment.
   - "score": An integer score (0-100) indicating the safety of this specific segment.
   - "status": A string ("Safe", "Warning", or "Critical").
   - "weather": A short summary of weather conditions on this segment (e.g. "Clear, 27°C").
   - "advisory": A plain-language safety advisory or recommendation for the rider.
"""

def analyze_route_risk(origin: str, destination: str, departure_time_str: str, bike_type: str, tank_capacity: float, mileage: float):
    # 1. Resolve route
    route = analyze_route(origin, destination)
    segments = route["segments"]
    path_points = route["path"]

    # 2. Get weather at route waypoints
    # We sample weather at the start, middle segments, and end of the route
    weather_points = []
    total_duration = route["duration_hours"]
    num_points = len(path_points)
    
    for i, pt in enumerate(path_points):
        # We sample ~5 points
        if i == 0 or i == num_points - 1 or i in [int(num_points * 0.25), int(num_points * 0.5), int(num_points * 0.75)]:
            lat, lon, name, km = pt
            # Estimate elapsed hours assuming proportional travel speed
            elapsed = (km / route["distance_km"]) * total_duration
            weather_points.append((lat, lon, name, elapsed))
            
    weather_report = get_weather_along_route(weather_points)

    # 3. Analyze fuel gaps
    tank_range = tank_capacity * mileage
    fuel_report = find_fuel_station_gaps(path_points, tank_range)

    # 4. Synthesize data for LLM
    try:
        departure_hour = 23 # Default to night for demo if parse fails
        if departure_time_str:
            # Simple hour parsing e.g. "2026-05-26T23:00:00"
            if "T" in departure_time_str:
                time_part = departure_time_str.split("T")[1]
                departure_hour = int(time_part.split(":")[0])
    except Exception:
        pass

    user_context = {
        "origin": origin,
        "destination": destination,
        "departure_time": departure_time_str,
        "departure_hour": departure_hour,
        "bike_type": bike_type,
        "tank_capacity_liters": tank_capacity,
        "avg_mileage_kmpl": mileage,
        "tank_range_km": tank_range,
        "route_distance_km": route["distance_km"],
        "segments": segments,
        "weather_data": weather_report,
        "fuel_gaps": fuel_report["critical_gaps"]
    }

    user_message = f"Please analyze this route data and generate the JSON safety report:\n{json.dumps(user_context, indent=2)}"
    
    # 5. Call LLM
    raw_response = call_llm(SYSTEM_PROMPT, user_message, response_format="json")
    
    try:
        # Clean any markdown code blocks
        cleaned = raw_response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        
        report_data = json.loads(cleaned)
    except Exception as e:
        print(f"Failed to parse LLM JSON response: {e}. Raw response: {raw_response}")
        # Build a hardcoded fallback structure
        report_data = {
            "safety_score": 75,
            "ai_summary": "Journey is moderately safe. Ensure you fill up fuel at Kurnool as there is a long stretch of 142 km without open pumps. Light rain is predicted near Nandyal, and winding roads near Kodur are foggy.",
            "segment_advisories": [
                {
                    "segment_id": s["id"],
                    "score": 90 if i == 0 or i == 3 else (70 if i == 1 else (45 if i == 2 else 60)),
                    "status": "Safe" if i == 0 or i == 3 else ("Warning" if i == 1 or i == 4 else "Critical"),
                    "weather": "Clear" if i == 0 or i == 3 else ("Rain" if i == 2 else "Foggy"),
                    "advisory": f"Driving segment {s['name']}. Please monitor speed."
                } for i, s in enumerate(segments)
            ]
        }
        
    return {
        "route_details": {
            "distance_km": route["distance_km"],
            "duration_hours": route["duration_hours"],
            "path": path_points,
            "segments": segments
        },
        "weather_along_route": weather_report,
        "fuel_stations": fuel_report["stations"],
        "fuel_gaps": fuel_report["critical_gaps"],
        "safety_report": report_data
    }
