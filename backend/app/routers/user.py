from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import json
from app.database import query_db, execute_db

router = APIRouter(prefix="/api/user", tags=["User"])


class Contact(BaseModel):
    name: str
    email: str
    relationship: str


class FavouritePlace(BaseModel):
    label: str
    address: str


class SettingsUpdateRequest(BaseModel):
    firebase_uid: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    mobile_number: Optional[str] = None
    bike_name: Optional[str] = None
    bike_type: Optional[str] = None
    petrol_type: Optional[str] = None
    tank_capacity_liters: Optional[float] = None
    avg_mileage_kmpl: Optional[float] = None
    inactivity_threshold_min: Optional[int] = None
    emergency_contacts: Optional[List[Contact]] = None
    favourite_places: Optional[List[FavouritePlace]] = None


def _get_user_by_firebase_uid(firebase_uid: str):
    user = query_db(
        "SELECT id FROM users WHERE firebase_uid = ?", (firebase_uid,), one=True
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user["id"]


@router.get("/settings")
def api_get_settings(firebase_uid: str):
    user_id = _get_user_by_firebase_uid(firebase_uid)
    settings = query_db("SELECT * FROM user_settings WHERE user_id = ?", (user_id,), one=True)
    user = query_db("SELECT full_name, email, mobile_number FROM users WHERE id = ?", (user_id,), one=True)

    if not settings:
        # Return defaults if no settings row yet
        return {
            "user_id": user_id,
            "full_name": user["full_name"] if user else "",
            "email": user["email"] if user else "",
            "mobile_number": user["mobile_number"] if user else "",
            "bike_name": "",
            "bike_type": "adventure",
            "petrol_type": "Petrol (Regular)",
            "tank_capacity_liters": 15.0,
            "avg_mileage_kmpl": 25.0,
            "inactivity_threshold_min": 8,
            "emergency_contacts": [],
            "favourite_places": [],
        }

    return {
        "user_id": user_id,
        "full_name": user["full_name"] if user else "",
        "email": user["email"] if user else "",
        "mobile_number": user["mobile_number"] if user else "",
        "bike_name": settings.get("bike_name") or "",
        "bike_type": settings.get("bike_type") or "adventure",
        "petrol_type": settings.get("petrol_type") or "Petrol (Regular)",
        "tank_capacity_liters": settings.get("tank_capacity_liters") or 15.0,
        "avg_mileage_kmpl": settings.get("avg_mileage_kmpl") or 25.0,
        "inactivity_threshold_min": settings.get("inactivity_threshold_min") or 8,
        "emergency_contacts": json.loads(settings["emergency_contacts"]) if settings.get("emergency_contacts") else [],
        "favourite_places": json.loads(settings["favourite_places"]) if settings.get("favourite_places") else [],
    }


@router.put("/settings")
def api_update_settings(req: SettingsUpdateRequest):
    user_id = _get_user_by_firebase_uid(req.firebase_uid)

    # Update user profile fields if provided
    if req.full_name is not None or req.email is not None or req.mobile_number is not None:
        updates = []
        values = []
        if req.full_name is not None:
            updates.append("full_name = ?"); values.append(req.full_name)
        if req.email is not None:
            updates.append("email = ?"); values.append(req.email)
        if req.mobile_number is not None:
            updates.append("mobile_number = ?"); values.append(req.mobile_number)
        if updates:
            values.append(user_id)
            execute_db(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", tuple(values))

    # Update settings
    existing = query_db("SELECT 1 FROM user_settings WHERE user_id = ?", (user_id,), one=True)

    contacts_json = json.dumps([c.model_dump() for c in req.emergency_contacts]) if req.emergency_contacts is not None else None
    places_json = json.dumps([p.model_dump() for p in req.favourite_places]) if req.favourite_places is not None else None

    if existing:
        set_clauses = []
        vals = []
        field_map = {
            "bike_name": req.bike_name,
            "bike_type": req.bike_type,
            "petrol_type": req.petrol_type,
            "tank_capacity_liters": req.tank_capacity_liters,
            "avg_mileage_kmpl": req.avg_mileage_kmpl,
            "inactivity_threshold_min": req.inactivity_threshold_min,
        }
        for col, val in field_map.items():
            if val is not None:
                set_clauses.append(f"{col} = ?"); vals.append(val)
        if contacts_json is not None:
            set_clauses.append("emergency_contacts = ?"); vals.append(contacts_json)
        if places_json is not None:
            set_clauses.append("favourite_places = ?"); vals.append(places_json)

        if set_clauses:
            vals.append(user_id)
            execute_db(f"UPDATE user_settings SET {', '.join(set_clauses)} WHERE user_id = ?", tuple(vals))
    else:
        execute_db(
            """
            INSERT INTO user_settings
            (user_id, bike_name, bike_type, petrol_type, tank_capacity_liters,
             avg_mileage_kmpl, inactivity_threshold_min, emergency_contacts, favourite_places)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                req.bike_name or "",
                req.bike_type or "adventure",
                req.petrol_type or "Petrol (Regular)",
                req.tank_capacity_liters or 15.0,
                req.avg_mileage_kmpl or 25.0,
                req.inactivity_threshold_min or 8,
                contacts_json or "[]",
                places_json or "[]",
            ),
        )

    return {"success": True}


@router.get("/journeys")
def api_list_journeys(firebase_uid: str):
    user_id = _get_user_by_firebase_uid(firebase_uid)
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
