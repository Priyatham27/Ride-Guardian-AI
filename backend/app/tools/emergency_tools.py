import os
import json
from app.config import (
    SMTP_SERVER,
    SMTP_PORT,
    SMTP_USERNAME,
    SMTP_PASSWORD,
    DEMO_EMERGENCY_EMAIL,
    GOOGLE_MAPS_API_KEY
)

# Seeded emergency contacts/hospitals/police locations along the NH-44 / NH-40 route
SEEDED_HOSPITALS = [
    {"name": "Apollo Hospitals - Hyderabad (Gachibowli)", "lat": 17.4100, "lon": 78.3800, "phone": "+914023607777", "city": "Hyderabad"},
    {"name": "Government General Hospital - Kurnool Bypass", "lat": 15.8200, "lon": 78.0400, "phone": "+918518255555", "city": "Kurnool"},
    {"name": "Nandyal Government Area Hospital", "lat": 15.4810, "lon": 78.4810, "phone": "+918514221100", "city": "Nandyal"},
    {"name": "RIMS Hospital (Rajiv Gandhi Institute of Medical Sciences) - Kadapa", "lat": 14.4600, "lon": 78.8300, "phone": "+918562220200", "city": "Kadapa"},
    {"name": "SVIMS (Sri Venkateswara Institute of Medical Sciences) - Tirupati", "lat": 13.6350, "lon": 79.4050, "phone": "+918772287777", "city": "Tirupati"}
]

SEEDED_POLICE_STATIONS = [
    {"name": "Shadnagar Police Station", "lat": 17.0710, "lon": 78.2050, "phone": "+918548252100"},
    {"name": "Jadcherla Police Station", "lat": 16.7620, "lon": 78.1380, "phone": "+918542232400"},
    {"name": "Kurnool Highway Patrol & Police Station", "lat": 15.8320, "lon": 78.0320, "phone": "+918518220033"},
    {"name": "Nandyal Town Police Station", "lat": 15.4900, "lon": 78.4720, "phone": "+918514246333"},
    {"name": "Kadapa Traffic Police Station", "lat": 14.4720, "lon": 78.8220, "phone": "+918562244400"},
    {"name": "Tirupati Alipiri Police Station", "lat": 13.6420, "lon": 79.4010, "phone": "+918772240100"}
]

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Simple Euclidean distance approximation for sorting nearby locations.
    """
    d_lat = lat1 - lat2
    d_lon = lon1 - lon2
    return ((d_lat * 111) ** 2 + (d_lon * 105) ** 2) ** 0.5

def find_nearest_hospital(lat: float, lon: float):
    """
    Finds the nearest hospital. Queries Google Places API if key is present,
    otherwise falls back to pre-seeded hospital data.
    """
    if GOOGLE_MAPS_API_KEY:
        try:
            import httpx
            url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={lat},{lon}&radius=20000&type=hospital&key={GOOGLE_MAPS_API_KEY}"
            res = httpx.get(url, timeout=5.0)
            if res.status_code == 200:
                results = res.json().get("results", [])
                if results:
                    place = results[0]
                    p_lat = place["geometry"]["location"]["lat"]
                    p_lon = place["geometry"]["location"]["lng"]
                    dist = calculate_distance(lat, lon, p_lat, p_lon)
                    return {
                        "name": place.get("name"),
                        "lat": p_lat,
                        "lon": p_lon,
                        "phone": "+91108",
                        "city": place.get("vicinity", "Local Area"),
                        "distance_km": round(dist, 1)
                    }
        except Exception as e:
            print(f"Places hospital search error: {e}")

    closest = None
    min_dist = float("inf")
    
    for h in SEEDED_HOSPITALS:
        dist = calculate_distance(lat, lon, h["lat"], h["lon"])
        if dist < min_dist:
            min_dist = dist
            closest = h.copy()
            closest["distance_km"] = round(dist, 1)
            
    return closest or {
        "name": "Local Government Hospital (Trauma Center)",
        "lat": lat,
        "lon": lon,
        "phone": "+91108",
        "city": "Unknown",
        "distance_km": 5.0
    }

def find_nearest_police_station(lat: float, lon: float):
    """
    Finds the nearest police station. Queries Google Places API if key is present,
    otherwise falls back to pre-seeded police data.
    """
    if GOOGLE_MAPS_API_KEY:
        try:
            import httpx
            url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={lat},{lon}&radius=20000&type=police&key={GOOGLE_MAPS_API_KEY}"
            res = httpx.get(url, timeout=5.0)
            if res.status_code == 200:
                results = res.json().get("results", [])
                if results:
                    place = results[0]
                    p_lat = place["geometry"]["location"]["lat"]
                    p_lon = place["geometry"]["location"]["lng"]
                    dist = calculate_distance(lat, lon, p_lat, p_lon)
                    return {
                        "name": place.get("name"),
                        "lat": p_lat,
                        "lon": p_lon,
                        "phone": "+91100",
                        "distance_km": round(dist, 1)
                    }
        except Exception as e:
            print(f"Places police search error: {e}")

    closest = None
    min_dist = float("inf")
    
    for p in SEEDED_POLICE_STATIONS:
        dist = calculate_distance(lat, lon, p["lat"], p["lon"])
        if dist < min_dist:
            min_dist = dist
            closest = p.copy()
            closest["distance_km"] = round(dist, 1)
            
    return closest or {
        "name": "Local Highway Patrol Division",
        "lat": lat,
        "lon": lon,
        "phone": "+91100",
        "distance_km": 5.0
    }

def send_emergency_alert(contact_info: str, message: str) -> dict:
    """
    Sends emergency Email using SMTP if config is set, otherwise simulates Firebase FCM/Email dispatch.
    """
    print(f"[EMERGENCY ALERT DISPATCH] Attempting to send to {contact_info}: '{message}'")
    
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        # Success fallback for demo
        print(f"[MOCK FCM/EMAIL] Credentials not fully set. Simulating successful dispatch to {contact_info}.")
        return {
            "success": True,
            "provider": "mock_fcm_email",
            "message": f"Simulated alert sent to {contact_info}: {message}",
            "sid": "mocked12345abcde67890fghij"
        }

    try:
        import smtplib
        from email.message import EmailMessage
        
        target_email = contact_info
        if "@" not in target_email and DEMO_EMERGENCY_EMAIL:
            # If contact doesn't have an email format but we have a demo email, use demo email
            target_email = DEMO_EMERGENCY_EMAIL
            
        msg = EmailMessage()
        msg.set_content(message)
        msg['Subject'] = 'EMERGENCY ALERT: RideGuardian Incident Detected'
        msg['From'] = SMTP_USERNAME
        msg['To'] = target_email

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        return {
            "success": True,
            "provider": "smtp_email",
            "sid": "email_" + str(hash(message)),
            "message": f"SMTP Email dispatched to {target_email}"
        }
    except Exception as e:
        print(f"[SMTP ERROR] Failed to dispatch via Email: {e}")
        return {
            "success": False,
            "provider": "email_failed",
            "error": str(e),
            "fallback_message": f"Could not send email to {contact_info}."
        }

