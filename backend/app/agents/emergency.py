import json
import uuid
from datetime import datetime
from app.database import query_db, execute_db
from app.tools.emergency_tools import find_nearest_hospital, find_nearest_police_station, send_emergency_alert
from app.agents.llm import call_llm

SYSTEM_PROMPT = """
You are the RideGuardian Emergency Agent. Your job is to draft a short, clear, and highly urgent distress message to be sent to a rider's emergency contacts.
You will be given the rider's name, the trigger reason (e.g. inactivity, manual SOS, or suspected crash), their current GPS coordinates, and the name of the nearest hospital.
Generate a concise, 1-2 sentence message. Include the live tracking link. Do not add fluff.
"""

def trigger_sos_workflow(journey_id: str, trigger_type: str, current_lat: float, current_lon: float) -> dict:
    """
    Orchestrates the emergency SOS sequence:
    1. Update journey status to 'emergency'.
    2. Lookup nearest hospital and police.
    3. Notify emergency contacts via SMS (Twilio or fallback).
    4. Log the incident record in SQLite.
    """
    # 1. Fetch journey and user settings
    journey = query_db("SELECT * FROM journeys WHERE id = ?", (journey_id,), one=True)
    if not journey:
        return {"success": False, "error": "Journey not found"}

    user = query_db("SELECT * FROM users WHERE id = ?", (journey["user_id"],), one=True)
    settings = query_db("SELECT * FROM user_settings WHERE user_id = ?", (journey["user_id"],), one=True)
    
    rider_name = user["full_name"] if user else "RideGuardian User"
    contacts = json.loads(settings["emergency_contacts"]) if settings and settings["emergency_contacts"] else []

    # 2. Find closest medical and safety services
    nearest_hospital = find_nearest_hospital(current_lat, current_lon)
    nearest_police = find_nearest_police_station(current_lat, current_lon)

    # 3. Formulate the SOS alert message using the LLM (or fallback template)
    location_url = f"https://rideguardian-ai.vercel.app/track/{journey_id}"
    
    llm_input = (
        f"Rider Name: {rider_name}\n"
        f"Trigger: {trigger_type.replace('_', ' ').title()}\n"
        f"GPS Coordinates: {current_lat}, {current_lon}\n"
        f"Live Link: {location_url}\n"
        f"Nearest Hospital: {nearest_hospital['name']} ({nearest_hospital['distance_km']} km away)"
    )
    
    try:
        sms_body = call_llm(SYSTEM_PROMPT, llm_input)
    except Exception:
        # Fallback template if LLM fails
        sms_body = (
            f"EMERGENCY: RideGuardian detected {trigger_type.replace('_', ' ')} for solo rider {rider_name}. "
            f"Last location: {location_url} . Nearest Hospital: {nearest_hospital['name']} ({nearest_hospital['distance_km']}km)."
        )

    # 4. Notify contacts
    notifications_sent = []
    for contact in contacts:
        phone = contact.get("phone", "")
        email = contact.get("email", "")
        name = contact.get("name", "Emergency Contact")
        contact_id = email if email else phone
        if contact_id:
            res = send_emergency_alert(contact_id, sms_body)
            notifications_sent.append({
                "name": name,
                "contact_id": contact_id,
                "success": res.get("success", False),
                "sid": res.get("sid", ""),
                "provider": res.get("provider", "mock")
            })

    # 5. Insert Incident record in DB
    incident_id = str(uuid.uuid4())
    execute_db(
        """
        INSERT INTO incidents (id, journey_id, trigger_type, last_known_lat, last_known_lon, sos_dispatched, contacts_notified, nearest_hospital)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        """,
        (
            incident_id,
            journey_id,
            trigger_type,
            current_lat,
            current_lon,
            json.dumps(notifications_sent),
            json.dumps(nearest_hospital)
        )
    )

    # 6. Update Journey status to 'emergency'
    execute_db(
        "UPDATE journeys SET status = ? WHERE id = ?",
        ("emergency", journey_id)
    )

    # Log risk event for the journey timeline
    event_id = str(uuid.uuid4())
    execute_db(
        """
        INSERT INTO risk_events (id, journey_id, event_type, severity, description, lat, lon, ai_recommendation)
        VALUES (?, ?, 'sos', 'critical', ?, ?, ?, ?)
        """,
        (
            event_id,
            journey_id,
            f"SOS Triggered via {trigger_type.upper()}.",
            current_lat,
            current_lon,
            f"Contacts notified. Emergency responders dispatched to coordinate: {current_lat}, {current_lon}."
        )
    )

    return {
        "success": True,
        "incident_id": incident_id,
        "trigger_type": trigger_type,
        "sms_body": sms_body,
        "contacts_notified": notifications_sent,
        "nearest_hospital": nearest_hospital,
        "nearest_police": nearest_police
    }
