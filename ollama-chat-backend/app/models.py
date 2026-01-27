from pydantic import BaseModel

class ChatRequest(BaseModel):
    session_id: str
    message: str

class StopRequest(BaseModel):
    session_id: str
