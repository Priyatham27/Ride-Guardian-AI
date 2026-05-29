from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid
import json
from app.database import query_db, execute_db

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class RegisterRequest(BaseModel):
    firebase_uid: str
    full_name: str
    email: str
    mobile_number: str
    password: Optional[str] = None  # stored in Firebase, not here


class ProfileRequest(BaseModel):
    firebase_uid: str
    full_name: str
    email: Optional[str] = None
    mobile_number: Optional[str] = None
    bike_name: Optional[str] = ""
    bike_type: str = "adventure"
    petrol_type: str = "Petrol (Regular)"
    tank_capacity_liters: float = 15.0
    avg_mileage_kmpl: float = 25.0
    inactivity_threshold_min: int = 8
    favourite_places: list = []
    emergency_contacts: list = []


@router.post("/register")
def api_register(req: RegisterRequest):
    """Create a new user record (called right after Firebase auth)."""
    # Check if user already exists by firebase_uid
    existing = query_db(
        "SELECT id FROM users WHERE firebase_uid = ?", (req.firebase_uid,), one=True
    )
    if existing:
        # Update name/email/phone in case they changed
        execute_db(
            "UPDATE users SET full_name = ?, email = ?, mobile_number = ? WHERE firebase_uid = ?",
            (req.full_name, req.email, req.mobile_number, req.firebase_uid),
        )
        return {"success": True, "user_id": existing["id"], "already_exists": True}

    # Check if email already exists with a different firebase_uid (from a previous auth method)
    existing_email = query_db(
        "SELECT id, firebase_uid FROM users WHERE email = ?", (req.email,), one=True
    )
    if existing_email:
        # Update the firebase_uid to the new one
        execute_db(
            "UPDATE users SET firebase_uid = ?, full_name = ?, mobile_number = ? WHERE id = ?",
            (req.firebase_uid, req.full_name, req.mobile_number, existing_email["id"]),
        )
        return {"success": True, "user_id": existing_email["id"], "already_exists": True}

    user_id = str(uuid.uuid4())
    try:
        execute_db(
            "INSERT INTO users (id, firebase_uid, email, full_name, mobile_number, has_profile) VALUES (?, ?, ?, ?, ?, 0)",
            (user_id, req.firebase_uid, req.email, req.full_name, req.mobile_number),
        )
        return {"success": True, "user_id": user_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/profile")
def api_save_profile(req: ProfileRequest):
    """Save full onboarding profile: bike details, favourite places, emergency contacts."""
    user = query_db(
        "SELECT id FROM users WHERE firebase_uid = ?", (req.firebase_uid,), one=True
    )
    
    # Auto-register user if they exist in Firebase but were not synced to our DB yet
    if not user:
        user_id = str(uuid.uuid4())
        execute_db(
            "INSERT INTO users (id, firebase_uid, email, full_name, mobile_number, has_profile) VALUES (?, ?, ?, ?, ?, 0)",
            (user_id, req.firebase_uid, req.email or "", req.full_name, req.mobile_number or ""),
        )
        user = {"id": user_id}

    user_id = user["id"]
    contacts_json = json.dumps(req.emergency_contacts)
    places_json = json.dumps(req.favourite_places)

    # Update user profile details
    updates = ["full_name = ?", "has_profile = 1"]
    params = [req.full_name]
    
    if req.email:
        updates.append("email = ?")
        params.append(req.email)
    if req.mobile_number:
        updates.append("mobile_number = ?")
        params.append(req.mobile_number)
        
    params.append(user_id)
    execute_db(
        f"UPDATE users SET {', '.join(updates)} WHERE id = ?",
        tuple(params),
    )

    # Upsert settings
    existing_settings = query_db(
        "SELECT 1 FROM user_settings WHERE user_id = ?", (user_id,), one=True
    )

    if existing_settings:
        execute_db(
            """
            UPDATE user_settings
            SET bike_name = ?, bike_type = ?, petrol_type = ?, tank_capacity_liters = ?,
                avg_mileage_kmpl = ?, inactivity_threshold_min = ?,
                favourite_places = ?, emergency_contacts = ?
            WHERE user_id = ?
            """,
            (
                req.bike_name, req.bike_type, req.petrol_type,
                req.tank_capacity_liters, req.avg_mileage_kmpl,
                req.inactivity_threshold_min, places_json, contacts_json,
                user_id,
            ),
        )
    else:
        execute_db(
            """
            INSERT INTO user_settings
            (user_id, bike_name, bike_type, petrol_type, tank_capacity_liters,
             avg_mileage_kmpl, inactivity_threshold_min, favourite_places, emergency_contacts)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id, req.bike_name, req.bike_type, req.petrol_type,
                req.tank_capacity_liters, req.avg_mileage_kmpl,
                req.inactivity_threshold_min, places_json, contacts_json,
            ),
        )

    return {"success": True, "user_id": user_id}


@router.get("/profile")
def api_get_profile(firebase_uid: str):
    """Get user profile — used by AuthContext on every load."""
    user = query_db(
        "SELECT id, full_name, email, mobile_number, has_profile FROM users WHERE firebase_uid = ?",
        (firebase_uid,), one=True
    )
    if not user:
        # User not in DB yet (just registered via Firebase but backend not called yet)
        raise HTTPException(status_code=404, detail="Profile not found")

    return {
        "uid": firebase_uid,
        "user_id": user["id"],
        "full_name": user["full_name"] or "",
        "email": user["email"] or "",
        "mobile_number": user["mobile_number"] or "",
        "has_profile": bool(user["has_profile"]),
    }
