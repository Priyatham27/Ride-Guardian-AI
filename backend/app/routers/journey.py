from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import uuid
import json
from datetime import datetime
from app.database import query_db, execute_db
from app.agents.analyst import analyze_route_risk
from app.agents.summary import generate_post_ride_summary

router = APIRouter(prefix="/api/journey", tags=["Journey"])

class AnalyzeRequest(BaseModel):
    origin: str
    destination: str
    departure_time: str
    fuel_capacity: float = 15.0
    bike_type: str = "adventure"
    firebase_uid: str = ""  # Used to resolve user_id
    user_id: str = ""  # Legacy fallback

class StartRequest(BaseModel):
    journey_id: str

@router.post("/analyze")
def api_analyze_journey(req: AnalyzeRequest):
    try:
        # Resolve user_id from firebase_uid
        user_id = req.user_id
        if req.firebase_uid:
            user = query_db("SELECT id FROM users WHERE firebase_uid = ?", (req.firebase_uid,), one=True)
            if user:
                user_id = user["id"]

        # Load user settings to get avg_mileage
        settings = query_db("SELECT * FROM user_settings WHERE user_id = ?", (user_id,), one=True)
        mileage = settings["avg_mileage_kmpl"] if settings else 25.0
        
        # Perform Route risk assessment
        analysis = analyze_route_risk(
            origin=req.origin,
            destination=req.destination,
            departure_time_str=req.departure_time,
            bike_type=req.bike_type,
            tank_capacity=req.fuel_capacity,
            mileage=mileage
        )
        
        # Save to database as a planned journey
        journey_id = str(uuid.uuid4())
        route_details = analysis["route_details"]
        path_coords = route_details["path"]
        
        origin_lat, origin_lon = path_coords[0][0], path_coords[0][1]
        dest_lat, dest_lon = path_coords[-1][0], path_coords[-1][1]
        
        # Store risk analysis result in DB
        execute_db(
            """
            INSERT INTO journeys (
                id, user_id, origin, destination, origin_lat, origin_lon, 
                destination_lat, destination_lon, departure_time, status, 
                route_polyline, risk_report, ai_narrative
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                journey_id,
                user_id,
                req.origin,
                req.destination,
                origin_lat,
                origin_lon,
                dest_lat,
                dest_lon,
                req.departure_time,
                "planned",
                "", # Polyline is simplified to waypoint lists in risk_report
                json.dumps(analysis),
                analysis["safety_report"]["ai_summary"]
            )
        )
        
        return {
            "success": True,
            "journey_id": journey_id,
            "analysis": analysis
        }
        
    except Exception as e:
        print(f"Error in analyze endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/start")
def api_start_journey(req: StartRequest):
    journey = query_db("SELECT * FROM journeys WHERE id = ?", (req.journey_id,), one=True)
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
        
    old_status = journey["status"]
    
    # Update status to active
    execute_db(
        "UPDATE journeys SET status = ? WHERE id = ?",
        ("active", req.journey_id)
    )
    
    # If the journey is transitioning from 'emergency', resolve any active/unresolved incidents
    if old_status == "emergency":
        execute_db(
            "UPDATE incidents SET resolved_at = ? WHERE journey_id = ? AND resolved_at IS NULL",
            (datetime.now().isoformat(), req.journey_id)
        )
    
    # Only insert the initial GPS ping at origin if transitioning from 'planned' (first time starting)
    if old_status == "planned":
        ping_id = str(uuid.uuid4())
        execute_db(
            "INSERT INTO gps_pings (id, journey_id, lat, lon, speed_kmh) VALUES (?, ?, ?, ?, ?)",
            (ping_id, req.journey_id, journey["origin_lat"], journey["origin_lon"], 0.0)
        )
    
    return {"success": True, "status": "active"}

@router.get("/{journey_id}/risk")
def api_get_journey_risk(journey_id: str):
    journey = query_db("SELECT * FROM journeys WHERE id = ?", (journey_id,), one=True)
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
        
    return {
        "journey_id": journey["id"],
        "origin": journey["origin"],
        "destination": journey["destination"],
        "departure_time": journey["departure_time"],
        "status": journey["status"],
        "analysis": json.loads(journey["risk_report"]) if journey["risk_report"] else {}
    }

@router.post("/{journey_id}/end")
def api_end_journey(journey_id: str):
    try:
        summary = generate_post_ride_summary(journey_id)
        return {"success": True, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{journey_id}/summary")
def api_get_journey_summary(journey_id: str):
    journey = query_db("SELECT * FROM journeys WHERE id = ?", (journey_id,), one=True)
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
        
    if journey["status"] != "completed" or not journey["ai_narrative"]:
        raise HTTPException(status_code=400, detail="Journey is not completed yet")
        
    return json.loads(journey["ai_narrative"])
