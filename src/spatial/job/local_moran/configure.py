import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)

class Config:
    AIRQO_API_TOKEN = os.getenv("AIRQO_API_TOKEN")