from fastapi import FastAPI, Depends, HTTPException, Header, APIRouter
from typing import List
from app.crud import create_user, authenticate_user, create_chat, get_user_chats, add_message, get_chat_messages, delete_chat
from app.auth import create_jwt, verify_jwt
from app.models import RegisterRequest, LoginRequest, ChatRequest, MessageRequest


router = APIRouter()

# Dependency to get current user from JWT
def get_current_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid auth")
    token = authorization.split(" ")[1]
    user_id = verify_jwt(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_id


# Auth routes
@router.post("/auth/register")
def register(req: RegisterRequest):
    user = create_user(req.email, req.password)
    token = create_jwt(user.id)
    return {"access_token": token}

@router.post("/auth/login")
def login(req: LoginRequest):
    user = authenticate_user(req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_jwt(user.id)
    return {"access_token": token}

# Chat routes
@router.post("/chats")
def new_chat(req: ChatRequest, user_id: int = Depends(get_current_user)):
    chat = create_chat(user_id, req.title)
    return chat

@router.get("/chats")
def list_chats(user_id: int = Depends(get_current_user)):
    return get_user_chats(user_id)

# Message routes
@router.post("/chats/{chat_id}/messages")
def create_message(chat_id: int, req: MessageRequest, user_id: int = Depends(get_current_user)):
    # Optional: verify chat belongs to user
    messages = add_message(chat_id, req.role, req.content)
    return messages

@router.get("/chats/{chat_id}")
def chat_history(chat_id: int, user_id: int = Depends(get_current_user)):
    # Optional: verify chat belongs to user
    messages = get_chat_messages(chat_id)
    #print("Retrieved messages for chat_id", chat_id, ":", messages.__len__())
    return messages

@router.delete("/chats/{chat_id}")
def delete_chat_endpoint(chat_id: int, user_id: int = Depends(get_current_user)):
    success = delete_chat(chat_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"status": "deleted"}