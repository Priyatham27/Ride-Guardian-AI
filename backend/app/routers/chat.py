from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uuid
import asyncio
from app.database import execute_db
from app.agents.copilot import generate_copilot_response

router = APIRouter(prefix="/api/chat", tags=["Chat"])

class ChatRequest(BaseModel):
    journey_id: str
    message: str

@router.post("/message")
async def api_chat_message(req: ChatRequest):
    """
    Saves message and streams the Co-Pilot AI's response via Server-Sent Events (SSE).
    """
    try:
        # 1. Save user message to database
        user_msg_id = str(uuid.uuid4())
        execute_db(
            "INSERT INTO chat_messages (id, journey_id, role, content) VALUES (?, ?, ?, ?)",
            (user_msg_id, req.journey_id, "user", req.message)
        )
        
        # 2. Get full Co-Pilot response
        full_response = generate_copilot_response(req.journey_id, req.message)
        
        # 3. Save assistant response to database
        assistant_msg_id = str(uuid.uuid4())
        execute_db(
            "INSERT INTO chat_messages (id, journey_id, role, content) VALUES (?, ?, ?, ?)",
            (assistant_msg_id, req.journey_id, "assistant", full_response)
        )
        
        # 4. Stream response word by word using Server-Sent Events
        async def event_generator():
            # Split by space and retain spacing
            words = full_response.split(" ")
            for i, word in enumerate(words):
                # Send SSE format
                chunk = word + (" " if i < len(words) - 1 else "")
                yield f"data: {chunk}\n\n"
                # Small delay to simulate real-time typing/streaming
                await asyncio.sleep(0.04)
            yield "data: [DONE]\n\n"
            
        return StreamingResponse(event_generator(), media_type="text/event-stream")
        
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
