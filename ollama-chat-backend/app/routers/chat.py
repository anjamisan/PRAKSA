
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.ollama_handler import generate_response, generate_title

from app.models import StopRequest
from app.sessions import sessions, SessionState

router = APIRouter()


@router.post("/title")
async def generate_title(request: Request):
    body = await request.json()
    message = body.get("message", "")
    
    if not message.strip():
        return {"title": "New Chat"}
    
    title = generate_title(message)
    return {"title": title}

@router.post("/chat")
async def chat_endpoint(request: Request):
    # Determine if request is JSON (text-only) or multipart/form-data (with images)
    content_type = request.headers.get("content-type", "")

    
    if "multipart/form-data" in content_type:
        print("MULTIPART/FORM-DATA detected")  # Debug
        # Vadim slike
        form = await request.form()
        session_id = form.get("session_id")
        message = form.get("message", "")
        model = form.get("model_index", "ministral-3:14b-cloud") #default to ministral if not provided
        
        # Get all uploaded images
        image_data = [] #lista slika u bajtovima
        print("Form keys:", list(form.keys())) # Debug
        for key in form:
            if key == "images":
                print("STIGLA SLIKA")  # Debug
                files = form.getlist("images")
                print(f"Number of files uploaded: {len(files)}")  # Debug
                for file in files:
                    if hasattr(file, 'read'):
                        print("is instance of file or UploadFile")  # Debug
                        img_bytes = await file.read()
                        image_data.append(img_bytes)
                        print(f"Read image: {len(img_bytes)} bytes")  # Debug
        
        if not message.strip() and not image_data:
            raise HTTPException(status_code=400, detail="No message or images provided")
        
    else:
        # Ako je samo tekst onda je json
        body = await request.json()
        session_id = body.get("session_id")
        message = body.get("message", "")
        model = body.get("model_index", "ministral-3:14b-cloud") #default to ministral if not provided
        image_data = None
        
        if not message.strip():
            raise HTTPException(status_code=400, detail="No message provided")

    # Get or create session
    if session_id not in sessions:
        sessions[session_id] = SessionState()

    session = sessions[session_id]

    return StreamingResponse(
        generate_response(session, message, model, image_data),
        media_type="text/plain",
    )


@router.post("/stop")
async def stop_generation(request: StopRequest):
    session = sessions.get(request.session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.cancel_event.set()
    session.generation_id = None
    if session.messages and session.messages[-1]["role"] == "user":
        session.messages.pop()

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