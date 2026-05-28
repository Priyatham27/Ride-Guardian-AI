import os
from dotenv import load_dotenv

# Load env variables from root or backend directory
# Root directory is three levels up: backend/app/config.py -> backend/app -> backend -> root
root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
root_env = os.path.join(root_dir, ".env")
backend_env = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")

load_dotenv(root_env, override=True)
load_dotenv(backend_env, override=True)
load_dotenv(override=True)

# API Keys
SAMBANOVA_API_KEY = os.getenv("SAMBANOVA_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")

# SMTP Email Config (optional)
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
DEMO_EMERGENCY_EMAIL = os.getenv("DEMO_EMERGENCY_EMAIL", "")

# Server settings
PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")
