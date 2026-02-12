import json
import uuid
import ollama
import base64
from datetime import datetime

from app.sessions import sessions, SessionState
from app.config import OLLAMA_MODEL_SMALL

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


def generate_response(session: SessionState, user_message: str, model: str, images: list[bytes] = None):
    # Create a unique generation id
    generation_id = str(uuid.uuid4())
    session.generation_id = generation_id
    session.cancel_event.clear()

    # Build user message with optional images
    user_msg = {"role": "user", "content": user_message}
    if images:
        # the images are base64 strings 
        user_msg["images"] = [base64.b64encode(img).decode("utf-8") for img in images]
        #user_msg["images"] = images # send raw bytes, let model handle it as it can detect image format from bytes
    
    session.messages.append(user_msg)
    response_content = ""
    

    print(f"\nSelected model: {model}\n")  # Debug
    for part in client.chat(
        model=model,
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
                model=model,
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

def generate_title(message: str):
    try:
        response = client.chat(
            model=OLLAMA_MODEL_SMALL,
            messages=[
                {
                    "role": "system",
                    "content": "Generate a short, concise title (max 50 characters) for a chat that starts with the following message. Only respond with the title, nothing else. Don't use any text markdown. Only plain text is allowed. Characters like * or quotes are FORBIDDEN in the title.",
                },
                {"role": "user", "content": message}
            ],
            stream=False,
        )
        title = response["message"]["content"].strip()
        print(f"Generated title: {title}")  # Debug
        # Ensure title is not too long
        if len(title) > 50:
            title = title[:47] + "..."
        return title
    except Exception as e:
        print(f"Error generating title: {e}")
        # Fallback to truncated message
        fallback = message[:50] + ("..." if len(message) > 50 else "")
        return fallback

