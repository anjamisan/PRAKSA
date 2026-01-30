from dotenv import load_dotenv
import os
from urllib.parse import quote_plus

load_dotenv()  # reads .env

DB_HOST = os.getenv("DB_HOST")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

PASSWORD = quote_plus(DB_PASSWORD)

DATABASE_URL = f"mysql+pymysql://{DB_USER}:{PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"