import sqlite3
import os
import json
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "rideguardian.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        full_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Create user_settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY,
        bike_type TEXT,
        tank_capacity_liters REAL,
        avg_mileage_kmpl REAL,
        inactivity_threshold_min INTEGER DEFAULT 8,
        emergency_contacts TEXT, -- JSON string
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)

    # Create journeys table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS journeys (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        origin TEXT,
        destination TEXT,
        origin_lat REAL,
        origin_lon REAL,
        destination_lat REAL,
        destination_lon REAL,
        departure_time TEXT,
        status TEXT, -- 'planned' | 'active' | 'completed' | 'emergency'
        route_polyline TEXT,
        risk_report TEXT, -- JSON string
        ai_narrative TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        ended_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)

    # Create gps_pings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS gps_pings (
        id TEXT PRIMARY KEY,
        journey_id TEXT,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        speed_kmh REAL,
        recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (journey_id) REFERENCES journeys(id)
    )
    """)

    # Create risk_events table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS risk_events (
        id TEXT PRIMARY KEY,
        journey_id TEXT,
        event_type TEXT, -- 'weather_alert'|'fuel_warning'|'fatigue'|'isolation'|'sos'
        severity TEXT, -- 'low'|'medium'|'high'|'critical'
        description TEXT,
        lat REAL,
        lon REAL,
        ai_recommendation TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (journey_id) REFERENCES journeys(id)
    )
    """)

    # Create chat_messages table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        journey_id TEXT,
        role TEXT, -- 'user' | 'assistant'
        content TEXT,
        tool_calls TEXT, -- JSON string
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (journey_id) REFERENCES journeys(id)
    )
    """)

    # Create incidents table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        journey_id TEXT,
        trigger_type TEXT, -- 'inactivity'|'crash_signal'|'manual_sos'
        triggered_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_known_lat REAL,
        last_known_lon REAL,
        sos_dispatched INTEGER DEFAULT 0,
        contacts_notified TEXT, -- JSON string
        nearest_hospital TEXT, -- JSON string
        resolved_at TEXT,
        resolved_by TEXT, -- 'rider_confirmed'|'contact_confirmed'|'auto_resolved'
        FOREIGN KEY (journey_id) REFERENCES journeys(id)
    )
    """)

    conn.commit()

    # Seed initial demo data if empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        demo_user_id = "8683bbb2-73a8-4caa-a63f-9f2ba8861716"
        cursor.execute(
            "INSERT INTO users (id, email, full_name) VALUES (?, ?, ?)",
            (demo_user_id, "arjun.adventure@rideguardian.ai", "Arjun Prasad")
        )

        contacts = [
            {"name": "Priya (Sister)", "email": "priyathamprime7@gmail.com", "relationship": "Sister"},
            {"name": "Ravi (Riding Buddy)", "email": "kotipallipriyatham85@gmail.com", "relationship": "Friend"}
        ]
        cursor.execute(
            """
            INSERT INTO user_settings (user_id, bike_type, tank_capacity_liters, avg_mileage_kmpl, inactivity_threshold_min, emergency_contacts)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (demo_user_id, "adventure", 18.0, 25.0, 1, json.dumps(contacts))  # default threshold is 1 minute for demo ease
        )

        conn.commit()
    
    conn.close()

# Helper db operations
def query_db(query, args=(), one=False):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(query, args)
    rv = cursor.fetchall()
    conn.close()
    
    # Convert sqlite3.Row items to dictionary
    result = [dict(r) for r in rv]
    return (result[0] if result else None) if one else result

def execute_db(query, args=()):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(query, args)
    conn.commit()
    conn.close()

# Run initialization on import
init_db()
print("SQLite Database Initialized.")
