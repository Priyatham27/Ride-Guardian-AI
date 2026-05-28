import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import journey, chat, emergency, user

app = FastAPI(
    title="RideGuardian AI API Gateway",
    description="Autonomous safety co-pilot API for solo travelers",
    version="1.0.0"
)

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(journey.router)
app.include_router(chat.router)
app.include_router(emergency.router)
app.include_router(user.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": "RideGuardian AI Backend Gateway",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import os
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
