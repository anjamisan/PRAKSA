import uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import ollama

from app.models import ChatRequest, StopRequest
from app.sessions import sessions, SessionState

router = APIRouter()


def generate_response(session: SessionState, user_message: str):
    # Create a unique generation id
    generation_id = str(uuid.uuid4())
    session.generation_id = generation_id
    session.cancel_event.clear()

    session.messages.append({"role": "user", "content": user_message})
    response_content = ""

    for part in ollama.chat(
        model="llama3.2:latest",
        messages=session.messages,
        stream=True,
    ):
        
        if (
            session.cancel_event.is_set()
            or session.generation_id != generation_id
        ):
            return  # exit generator completely

        chunk = part["message"]["content"]
        if chunk:
            response_content += chunk
            yield chunk

    # Only commit assistant message if still valid
    if session.generation_id == generation_id:
        session.messages.append(
            {"role": "assistant", "content": response_content}
        )

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="No message provided")

    # Get or create session
    if request.session_id not in sessions:
        sessions[request.session_id] = SessionState()

    session = sessions[request.session_id]

    return StreamingResponse(
        generate_response(session, request.message),
        media_type="text/plain",
    )

@router.post("/stop")
async def stop_generation(request: StopRequest):
    session = sessions.get(request.session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.cancel_event.set()
    return {"status": "stopped"}

# @router.post("/chat/full")
# async def chat_full_endpoint(request: ChatRequest):
#     if not request.message.strip():
#         raise HTTPException(status_code=400, detail="No message provided")
    
#     global messages
#     messages.append({"role": "user", "content": request.message})
    
#     try:
#         # Get full response without streaming
#         response = ollama.chat('llama3.2:latest', messages=messages, stream=False)
#         full_content = response['message']['content']
        
#         messages.append({"role": "assistant", "content": full_content})
        
#         return {"response": full_content}
#     except Exception as e:
#         print(f"Error in chat_full_endpoint: {e}")
#         raise HTTPException(status_code=500, detail=str(e))