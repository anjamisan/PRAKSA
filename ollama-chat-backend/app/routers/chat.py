import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import json
import ollama

from app.models import ConversationRequest, StopRequest
from app.sessions import sessions, SessionState

router = APIRouter()
client = ollama.Client()

# Tool functions
def get_current_datetime() -> str:
    
    """Answers the questions about current date and/or time.
        can also help calculating what date or time it will be in x days/hours/minutes from now.
    """
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

available_tools = {
    "get_current_datetime": get_current_datetime,
}

tool_definitions = [
    {
        "type": "function",
        "function": {
            "name": "get_current_datetime",
            "description": "Returns the current date and time",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    }
]

def handle_tool_calls(session: SessionState, tool_calls: list[dict]):
    
    tool_messages = []

    for tool_call in tool_calls:
        fn_name = tool_call["function"]["name"]
        fn_args = tool_call["function"].get("arguments", {})

        function_to_call = available_tools.get(fn_name)

        if not function_to_call:
            print("Function not found:", fn_name)
            continue

        print("Calling function:", fn_name)
        print("Arguments:", fn_args)

        result = function_to_call(**fn_args)

        print("Function output:", result)

        # Each tool result becomes its own tool message
        tool_messages.append({
            "role": "tool",
            "tool_name": fn_name,
            "content": str(result),
        })

    # Append all tool outputs
    session.messages.extend(tool_messages)


def generate_response(session: SessionState, user_message: str):
    # Create a unique generation id
    generation_id = str(uuid.uuid4())
    session.generation_id = generation_id
    session.cancel_event.clear()

    session.messages.append({"role": "user", "content": user_message})
    response_content = ""

    for part in client.chat(
        model="gpt-oss:120b-cloud",
        messages=session.messages,
        tools=tool_definitions,
        stream=True,
    ):
        
        if (
            session.cancel_event.is_set()
            or session.generation_id != generation_id
        ):
            return  # exit generator completely

        message = part.get("message", {})

        # IF tool calls are present, handle them
        tool_calls = message.get("tool_calls")
        if tool_calls:
            session.messages.append(message)  # log the tool call message
            handle_tool_calls(session, tool_calls)

            # second model call
            for part in client.chat(
                model="gpt-oss:120b-cloud",
                messages=session.messages,
                stream=True,
            ):
                if session.cancel_event.is_set() or session.generation_id != generation_id:
                    return

                chunk = part["message"]["content"]
                if chunk:
                    response_content += chunk
                    yield chunk

            break  # stop outer loop

        # IF normal message chunk, yield it
        chunk = message.get("content")
        if chunk:
            response_content += chunk
            yield chunk
    # Only commit assistant message if still valid
    if session.generation_id == generation_id:
        session.messages.append(
            {"role": "assistant", "content": response_content}
        )


@router.post("/chat")
async def chat_endpoint(request: ConversationRequest):
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