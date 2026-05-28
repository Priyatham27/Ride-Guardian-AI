import json
from datetime import datetime
from app.database import query_db, execute_db
from app.agents.llm import call_llm
from app.tools.emergency_tools import find_nearest_hospital, find_nearest_police_station, send_emergency_alert

SYSTEM_PROMPT_TEMPLATE = """
You are RideGuardian AI, the autonomous safety co-pilot riding alongside a solo traveler.
You are in active-ride mode. You MUST communicate with the rider under strict constraints:
1. Keep responses under 40 words.
2. Optimize for voice playback: NO markdown, NO bullet points, NO asterisk formatting, NO lists. Keep it conversational.
3. Be direct, clear, and proactive. If there is a major safety risk ahead, warn them immediately even if they did not ask.

CURRENT JOURNEY CONTEXT:
- Origin: {origin} -> Destination: {destination}
- Current Rider GPS: {lat}, {lon}
- Current speed: {speed_kmh} km/h
- Elapsed Time: {elapsed_time}
- Remaining Fuel Range: {remaining_range_km} km (Tank at {fuel_pct}%)
- Road Segment: {segment_name}
- Segment Risk Rating: {segment_risk_status} ({segment_risk_score}/100)
- Nearest Fuel Station: {next_station_name} at km {next_station_km} ({next_station_status})
- Nearest Hospital: {nearest_hospital_name} ({nearest_hospital_dist} km away)
- Emergency Contact: {emergency_contact_name} ({emergency_contact_email})

Use this context to answer the user's questions. Always use the context numbers directly. If the user asks you to send location, simulate calling contact_share_location and say you have sent it.
"""

def generate_copilot_response(journey_id: str, user_message: str) -> str:
    # 1. Fetch journey details
    journey = query_db("SELECT * FROM journeys WHERE id = ?", (journey_id,), one=True)
    if not journey:
        return "Journey not found. Please start a journey first."
        
    # 2. Fetch latest GPS ping
    ping = query_db("SELECT * FROM gps_pings WHERE journey_id = ? ORDER BY recorded_at DESC LIMIT 1", (journey_id,), one=True)
    lat = ping["lat"] if ping else journey["origin_lat"]
    lon = ping["lon"] if ping else journey["origin_lon"]
    speed = ping["speed_kmh"] if ping else 0.0

    # 3. Load settings for fuel math
    settings = query_db("SELECT * FROM user_settings WHERE user_id = ?", (journey["user_id"],), one=True)
    tank_capacity = settings["tank_capacity_liters"] if settings else 18.0
    mileage = settings["avg_mileage_kmpl"] if settings else 25.0
    contacts = []
    if settings and settings["emergency_contacts"]:
        try:
            contacts = json.loads(settings["emergency_contacts"])
        except Exception:
            pass
    
    e_contact_name = contacts[0]["name"] if contacts else "Priya"
    e_contact_email = contacts[0]["email"] if contacts else "priyathamprime7@gmail.com"

    # 4. Determine current segment & risk
    risk_report = {}
    if journey["risk_report"]:
        try:
            risk_report = json.loads(journey["risk_report"])
        except Exception:
            pass
    route_details = risk_report.get("route_details", {})
    path = route_details.get("path", [])
    
    # Estimate distance traveled based on current lat/lon relative to path
    dist_traveled = 0
    min_dist = float("inf")
    closest_idx = 0
    for idx, pt in enumerate(path):
        pt_lat, pt_lon, _, km = pt
        d = ((pt_lat - lat)**2 + (pt_lon - lon)**2)**0.5
        if d < min_dist:
            min_dist = d
            closest_idx = idx
            dist_traveled = km
            
    # Find current segment
    current_segment = "NH-44 Corridor"
    segment_risk_status = "Safe"
    segment_risk_score = 90
    for seg in route_details.get("segments", []):
        if seg["start_km"] <= dist_traveled <= seg["end_km"]:
            current_segment = seg["name"]
            
    # Find segment risk in safety report
    safety_report = risk_report.get("safety_report", {})
    for adv in safety_report.get("segment_advisories", []):
        if adv["segment_id"] in [s["id"] for s in route_details.get("segments", []) if s["name"] == current_segment]:
            segment_risk_status = adv["status"]
            segment_risk_score = adv["score"]

    # Calculate remaining fuel range (simulated consumption based on distance)
    # Start with 90% fuel, deplete as distance increases
    total_dist = route_details.get("distance_km", 560)
    consumed_pct = (dist_traveled / total_dist) * 80 if total_dist > 0 else 0
    fuel_pct = max(10, round(90 - consumed_pct))
    remaining_range_km = round((fuel_pct / 100.0) * tank_capacity * mileage)

    # Next fuel station
    stations = risk_report.get("fuel_stations", [])
    next_station = {"name": "Tirupati IOCL", "km_mark": total_dist, "status": "Open"}
    for s in stations:
        if s["km_mark"] > dist_traveled:
            next_station = s
            break

    # Nearest Hospital
    hospital = find_nearest_hospital(lat, lon)
    
    # 5. Populate System Prompt
    # Calculate elapsed time format
    created_time = datetime.strptime(journey["created_at"], "%Y-%m-%d %H:%M:%S") if " " in journey["created_at"] else datetime.now()
    elapsed_delta = datetime.now() - created_time
    hours, remainder = divmod(elapsed_delta.seconds, 3600)
    minutes, _ = divmod(remainder, 60)
    elapsed_str = f"{hours}h {minutes}m"

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        origin=journey["origin"],
        destination=journey["destination"],
        lat=round(lat, 4),
        lon=round(lon, 4),
        speed_kmh=round(speed),
        elapsed_time=elapsed_str,
        remaining_range_km=remaining_range_km,
        fuel_pct=fuel_pct,
        segment_name=current_segment,
        segment_risk_status=segment_risk_status,
        segment_risk_score=segment_risk_score,
        next_station_name=next_station["name"],
        next_station_km=next_station["km_mark"] - dist_traveled,
        next_station_status=next_station["status"],
        nearest_hospital_name=hospital["name"],
        nearest_hospital_dist=hospital["distance_km"],
        emergency_contact_name=e_contact_name,
        emergency_contact_email=e_contact_email
    )

    # 6. Execute location sharing tool if requested
    user_lower = user_message.lower()
    if "send my location" in user_lower or "share my location" in user_lower:
        user = query_db("SELECT full_name FROM users WHERE id = ?", (journey["user_id"],), one=True)
        rider_name = user["full_name"] if user else "Arjun Prasad"
        loc_url = f"https://rideguardian-ai.vercel.app/track/{journey_id}"
        msg = f"RideGuardian Alert: {rider_name} is riding from {journey['origin']} to {journey['destination']}. Current location: {loc_url}."
        send_emergency_alert(e_contact_email, msg)

    # 7. Call LLM
    # Feed chat history if available, but for MVP a single turn prompt with full context is fastest & most reliable
    response = call_llm(system_prompt, user_message)
    return response.strip()
