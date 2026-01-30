from sqlmodel import select
from app.models import User, Chat, Message
from datetime import datetime, timezone
from passlib.hash import argon2
from typing import List
from app.database import get_session

# Users
def create_user(email: str, password: str):
    print("Password type:", type(password))
    print("Password repr:", repr(password))
    print("Password length (bytes):", len(password.encode("utf-8")))
    password_hash = argon2.hash(password)
    user = User(email=email, password_hash=password_hash, created_at=datetime.now(timezone.utc))
    with next(get_session()) as session:
        session.add(user)
        session.commit()
        session.refresh(user)
        return user

def authenticate_user(email: str, password: str):
    with next(get_session()) as session:
        user = session.exec(select(User).where(User.email == email)).first()
        if user and argon2.verify(password, user.password_hash):
            return user
        return None

# Chats
def create_chat(user_id: int, title: str):
    chat = Chat(user_id=user_id, title=title, created_at=datetime.now(timezone.utc))
    with next(get_session()) as session:
        session.add(chat)
        session.commit()
        session.refresh(chat)
        return chat

def get_user_chats(user_id: int) -> List[Chat]:
    with next(get_session()) as session:
        return session.exec(select(Chat).where(Chat.user_id == user_id)).all()

def get_chat(chat_id: int) -> Chat:
    with next(get_session()) as session:
        return session.exec(select(Chat).where(Chat.id == chat_id)).first()

# Messages
def add_message(chat_id: int, role: str, content: str):
    message = Message(chat_id=chat_id, role=role, content=content, created_at=datetime.now(timezone.utc))
    with next(get_session()) as session:
        session.add(message)
        session.commit()
        session.refresh(message)
        return message

def get_chat_messages(chat_id: int) -> List[Message]:
    with next(get_session()) as session:
        return session.exec(
            select(Message).where(Message.chat_id == chat_id).order_by(Message.created_at)
        ).all()

def delete_chat(chat_id: int, user_id: int) -> bool:
    with next(get_session()) as session:
        chat = session.exec(select(Chat).where(Chat.id == chat_id)).first()
        if not chat or chat.user_id != user_id:
            return False
        session.delete(chat)
        session.commit()
        return True
