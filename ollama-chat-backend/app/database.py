from sqlmodel import create_engine, Session, SQLModel

from app.config import DATABASE_URL
from app import models

engine = create_engine(DATABASE_URL, echo=True)

def get_session():
    """Yield a SQLModel session"""
    with Session(engine) as session:
        yield session

def create_db_and_tables():
    """Create all database tables"""
    SQLModel.metadata.create_all(engine)
