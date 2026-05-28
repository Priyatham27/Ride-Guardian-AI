from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
from app.database import query_db, execute_db

router = APIRouter(prefix="/api/user", tags=["User"])

class Contact(BaseModel):
    name: str
    email: str
    relationship: str

class SettingsUpdateRequest(BaseModel):
    bike_type: str
    tank_capacity_liters: float
    avg_mileage_kmpl: float
    inactivity_threshold_min: int
    emergency_contacts: list[Contact]
    user_id: str = "8683bbb2-73a8-4caa-a63f-9f2ba8861716"

@router.get("/settings")
def api_get_settings(user_id: str = "8683bbb2-73a8-4caa-a63f-9f2ba8861716"):
    settings = query_db("SELECT * FROM user_settings WHERE user_id = ?", (user_id,), one=True)
    user = query_db("SELECT full_name FROM users WHERE id = ?", (user_id,), one=True)
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
        
    return {
        "user_id": settings["user_id"],
        "full_name": user["full_name"] if user else "Arjun Prasad",
        "bike_type": settings["bike_type"],
        "tank_capacity_liters": settings["tank_capacity_liters"],
        "avg_mileage_kmpl": settings["avg_mileage_kmpl"],
        "inactivity_threshold_min": settings["inactivity_threshold_min"],
        "emergency_contacts": json.loads(settings["emergency_contacts"]) if settings["emergency_contacts"] else []
    }

@router.put("/settings")
def api_update_settings(req: SettingsUpdateRequest):
    try:
        # Check if settings row exists
        existing = query_db("SELECT 1 FROM user_settings WHERE user_id = ?", (req.user_id,), one=True)
        
        contacts_json = json.dumps([c.model_dump() for c in req.emergency_contacts])
        
        if existing:
            execute_db(
                """
                UPDATE user_settings
                SET bike_type = ?, tank_capacity_liters = ?, avg_mileage_kmpl = ?, 
                    inactivity_threshold_min = ?, emergency_contacts = ?
                WHERE user_id = ?
                """,
                (
                    req.bike_type,
                    req.tank_capacity_liters,
                    req.avg_mileage_kmpl,
                    req.inactivity_threshold_min,
                    contacts_json,
                    req.user_id
                )
            )
        else:
            execute_db(
                """
                INSERT INTO user_settings (user_id, bike_type, tank_capacity_liters, avg_mileage_kmpl, inactivity_threshold_min, emergency_contacts)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    req.user_id,
                    req.bike_type,
                    req.tank_capacity_liters,
                    req.avg_mileage_kmpl,
                    req.inactivity_threshold_min,
                    contacts_json
                )
            )
            
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/journeys")
def api_list_journeys(user_id: str = "8683bbb2-73a8-4caa-a63f-9f2ba8861716"):
    journeys = query_db(
        "SELECT id, origin, destination, departure_time, status, created_at, ended_at, ai_narrative FROM journeys WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,)
    )
    
    formatted = []
    for j in journeys:
        summary_info = {}
        if j["ai_narrative"] and j["status"] == "completed":
            try:
                summary_info = json.loads(j["ai_narrative"])
            except Exception:
                summary_info = {"narrative": j["ai_narrative"]}
                
        formatted.append({
            "id": j["id"],
            "origin": j["origin"],
            "destination": j["destination"],
            "departure_time": j["departure_time"],
            "status": j["status"],
            "created_at": j["created_at"],
            "ended_at": j["ended_at"],
            "summary": summary_info
        })
        
    return formatted
