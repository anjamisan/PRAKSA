from sqlmodel import select, Session
from app.models import User, Chat, Message
from datetime import datetime, timezone
from passlib.hash import argon2
from typing import List

# Users
def create_user(session: Session, email: str, password: str):
    print("Password type:", type(password))
    print("Password repr:", repr(password))
    print("Password length (bytes):", len(password.encode("utf-8")))
    password_hash = argon2.hash(password)
    user = User(email=email, password_hash=password_hash, created_at=datetime.now(timezone.utc))
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

def authenticate_user(session: Session, email: str, password: str):
    user = session.exec(select(User).where(User.email == email)).first()
    if user and argon2.verify(password, user.password_hash):
        return user
    return None

# Chats
def create_chat(session: Session, user_id: int, title: str):
    chat = Chat(user_id=user_id, title=title, created_at=datetime.now(timezone.utc))
    session.add(chat)
    session.commit()
    session.refresh(chat)
    return chat

def get_user_chats(session: Session, user_id: int) -> List[Chat]:
    return session.exec(select(Chat).where(Chat.user_id == user_id)).all()

# Messages
def add_message(session: Session, chat_id: int, role: str, content: str):
    message = Message(chat_id=chat_id, role=role, content=content, created_at=datetime.now(timezone.utc))
    session.add(message)
    session.commit()
    session.refresh(message)
    return message

def get_chat_messages(session: Session, chat_id: int) -> List[Message]:
    return session.exec(
        select(Message).where(Message.chat_id == chat_id).order_by(Message.created_at)
    ).all()

def delete_chat(session: Session, chat_id: int, user_id: int) -> bool:
    chat = session.exec(select(Chat).where(Chat.id == chat_id)).first()
    if not chat or chat.user_id != user_id:
        return False
    session.delete(chat)
    session.commit()
    return True
