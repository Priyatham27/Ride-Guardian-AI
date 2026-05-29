import sqlite3
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "rideguardian.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn

def init_db():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Check if users table needs migration (if email column is unique/not null in existing schema)
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
        users_sql_row = cursor.fetchone()
        
        needs_migration = False
        if users_sql_row:
            users_sql = users_sql_row[0]
            # If the schema definition has UNIQUE constraint on email
            if "email TEXT UNIQUE" in users_sql or ("email" in users_sql and "UNIQUE" in users_sql.split("email")[1].split(",")[0]):
                needs_migration = True

        if needs_migration:
            print("Migrating users table to remove email UNIQUE constraint...")
            cursor.execute("PRAGMA foreign_keys=OFF")
            cursor.execute("ALTER TABLE users RENAME TO users_old")
            cursor.execute("""
            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                firebase_uid TEXT UNIQUE,
                email TEXT,
                full_name TEXT,
                mobile_number TEXT,
                has_profile INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """)
            cursor.execute("""
            INSERT INTO users (id, firebase_uid, email, full_name, mobile_number, has_profile, created_at)
            SELECT id, firebase_uid, email, full_name, mobile_number, has_profile, created_at FROM users_old
            """)
            cursor.execute("DROP TABLE users_old")
            cursor.execute("PRAGMA foreign_keys=ON")
            print("Users table migration completed successfully.")
        else:
            # Create users table with the correct schema if it doesn't exist
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                firebase_uid TEXT UNIQUE,
                email TEXT,
                full_name TEXT,
                mobile_number TEXT,
                has_profile INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """)

        # Drop email uniqueness index if it exists
        try:
            cursor.execute("DROP INDEX IF EXISTS idx_users_email")
        except Exception:
            pass

        # Migrate: add columns if they don't exist
        _safe_add_column(cursor, "users", "firebase_uid", "TEXT")
        _safe_add_column(cursor, "users", "mobile_number", "TEXT")
        _safe_add_column(cursor, "users", "has_profile", "INTEGER DEFAULT 0")

        # Create user_settings table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_settings (
            user_id TEXT PRIMARY KEY,
            bike_name TEXT,
            bike_type TEXT,
            petrol_type TEXT DEFAULT 'Petrol (Regular)',
            tank_capacity_liters REAL,
            avg_mileage_kmpl REAL,
            inactivity_threshold_min INTEGER DEFAULT 8,
            emergency_contacts TEXT, -- JSON string
            favourite_places TEXT DEFAULT '[]', -- JSON string
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """)

        _safe_add_column(cursor, "user_settings", "bike_name", "TEXT")
        _safe_add_column(cursor, "user_settings", "petrol_type", "TEXT DEFAULT 'Petrol (Regular)'")
        _safe_add_column(cursor, "user_settings", "favourite_places", "TEXT DEFAULT '[]'")

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
            event_type TEXT,
            severity TEXT,
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
            role TEXT,
            content TEXT,
            tool_calls TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (journey_id) REFERENCES journeys(id)
        )
        """)

        # Create incidents table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            id TEXT PRIMARY KEY,
            journey_id TEXT,
            trigger_type TEXT,
            triggered_at TEXT DEFAULT CURRENT_TIMESTAMP,
            last_known_lat REAL,
            last_known_lon REAL,
            sos_dispatched INTEGER DEFAULT 0,
            contacts_notified TEXT,
            nearest_hospital TEXT,
            resolved_at TEXT,
            resolved_by TEXT,
            FOREIGN KEY (journey_id) REFERENCES journeys(id)
        )
        """)

        conn.commit()
    finally:
        conn.close()

def _safe_add_column(cursor, table: str, column: str, col_type: str):
    """Add column to table if it doesn't already exist."""
    try:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
    except Exception:
        pass  # Column already exists

# Helper db operations
def query_db(query, args=(), one=False):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(query, args)
        rv = cursor.fetchall()
        result = [dict(r) for r in rv]
        return (result[0] if result else None) if one else result
    finally:
        conn.close()

def execute_db(query, args=()):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(query, args)
        conn.commit()
    finally:
        conn.close()

# Run initialization on import
init_db()
print("SQLite Database Initialized.")
