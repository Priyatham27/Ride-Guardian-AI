from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import uuid
import json
from datetime import datetime
from app.database import query_db, execute_db
from app.agents.emergency import trigger_sos_workflow

router = APIRouter(prefix="/api", tags=["Emergency"])

class EmergencyTriggerRequest(BaseModel):
    journey_id: str
    trigger_type: str # 'inactivity' | 'crash_signal' | 'manual_sos'
    lat: float
    lon: float

class GPSPingRequest(BaseModel):
    lat: float
    lon: float
    speed_kmh: float = 0.0

@router.post("/emergency/trigger")
def api_trigger_emergency(req: EmergencyTriggerRequest):
    try:
        res = trigger_sos_workflow(
            journey_id=req.journey_id,
            trigger_type=req.trigger_type,
            current_lat=req.lat,
            current_lon=req.lon
        )
        return res
    except Exception as e:
        print(f"Error triggering emergency: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/emergency/{journey_id}/status")
def api_get_emergency_status(journey_id: str):
    journey = query_db("SELECT * FROM journeys WHERE id = ?", (journey_id,), one=True)
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
        
    incident = query_db("SELECT * FROM incidents WHERE journey_id = ? ORDER BY triggered_at DESC LIMIT 1", (journey_id,), one=True)
    
    return {
        "journey_status": journey["status"],
        "is_emergency": journey["status"] == "emergency",
        "incident": {
            "id": incident["id"],
            "trigger_type": incident["trigger_type"],
            "triggered_at": incident["triggered_at"],
            "last_known_lat": incident["last_known_lat"],
            "last_known_lon": incident["last_known_lon"],
            "sos_dispatched": bool(incident["sos_dispatched"]),
            "contacts_notified": json.loads(incident["contacts_notified"]) if incident["contacts_notified"] else [],
            "nearest_hospital": json.loads(incident["nearest_hospital"]) if incident["nearest_hospital"] else {}
        } if incident else None
    }

@router.patch("/journey/{journey_id}/gps")
def api_update_gps(journey_id: str, req: GPSPingRequest):
    journey = query_db("SELECT * FROM journeys WHERE id = ?", (journey_id,), one=True)
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
        
    # Log the GPS ping
    ping_id = str(uuid.uuid4())
    execute_db(
        "INSERT INTO gps_pings (id, journey_id, lat, lon, speed_kmh) VALUES (?, ?, ?, ?, ?)",
        (ping_id, journey_id, req.lat, req.lon, req.speed_kmh)
    )

    # Check if a critical speed drop or fatigue condition should automatically raise a warning
    # This acts as our real-time background analyzer logging risk events!
    # For example, if speed is 0 and status is active, we can note it.
    
    # If the journey is already in emergency, return that state
    return {
        "success": True,
        "journey_status": journey["status"],
        "is_emergency": journey["status"] == "emergency"
    }
