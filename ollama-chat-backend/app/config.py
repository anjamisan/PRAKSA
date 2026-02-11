import os
from dotenv import load_dotenv

load_dotenv()

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "ministral-3:14b-cloud")
OLLAMA_MODEL_SMALL = os.getenv("OLLAMA_MODEL_SMALL", "ministral-3:3b-cloud")
MODEL1 = os.getenv("MODEL1", "llama3.2:latest")
MODEL2 = os.getenv("MODEL2", "gpt-oss:120b-cloud")
MODEL3 = os.getenv("MODEL3", "qwen3-vl:235b-cloud")
MODEL4 = os.getenv("MODEL4", "ministral-3:14b-cloud")

MODEL_MAP = {
    1: MODEL1,
    2: MODEL2,
    3: MODEL3,
    4: MODEL4,
}

from urllib.parse import quote_plus

DB_HOST = os.getenv("DB_HOST")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

PASSWORD = quote_plus(DB_PASSWORD)

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"