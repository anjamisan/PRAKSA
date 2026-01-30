from pydantic import BaseModel
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime


class ConversationRequest(BaseModel):
    session_id: str
    message: str

class StopRequest(BaseModel):
    session_id: str

class RegisterRequest(BaseModel):
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ChatRequest(BaseModel):
    title: str

class MessageRequest(BaseModel):
    role: str
    content: str



####### DB ################


class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True)
    password_hash: str
    created_at: datetime

    chats: List["Chat"] = Relationship(back_populates="user")


class Chat(SQLModel, table=True):
    __tablename__ = "chats"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id")
    title: str
    created_at: datetime

    user: Optional[User] = Relationship(back_populates="chats")
    messages: List["Message"] = Relationship(back_populates="chat")


class Message(SQLModel, table=True):
    __tablename__ = "messages"
    id: Optional[int] = Field(default=None, primary_key=True)
    chat_id: int = Field(foreign_key="chats.id")
    role: str  # 'system', 'user', 'assistant', 'tool'
    content: str
    created_at: datetime

    chat: Optional[Chat] = Relationship(back_populates="messages")
