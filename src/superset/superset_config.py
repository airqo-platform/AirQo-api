import os

# Security & Flask settings
SECRET_KEY = os.getenv("SUPERSET_SECRET_KEY")
FLASK_ENV = os.getenv("FLASK_ENV", "production")

# Database Connection
SQLALCHEMY_DATABASE_URI = f"{os.getenv('DATABASE_DIALECT')}://{os.getenv('DATABASE_USER')}:{os.getenv('DATABASE_PASSWORD')}@{os.getenv('DATABASE_HOST')}:{os.getenv('DATABASE_PORT')}/{os.getenv('DATABASE_DB')}"
SQLALCHEMY_TRACK_MODIFICATIONS = False

# Web Server Settings
ENABLE_PROXY_FIX = os.getenv("SUPERSET_WEBSERVER_ENABLE_PROXY_FIX", "True") == "True"
WEBSERVER_ADDRESS = os.getenv("SUPERSET_WEBSERVER_HOST")
WEBSERVER_PORT = int(os.getenv("SUPERSET_WEBSERVER_PORT"))
SUPERSET_WEBSERVER_TIMEOUT = int(os.getenv("SUPERSET_WEBSERVER_TIMEOUT", 300))

# Public URL
SUPERSET_PUBLIC_URL = os.getenv("SUPERSET_PUBLIC_URL")

