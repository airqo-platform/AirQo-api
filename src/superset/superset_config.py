import environ

import logging

env = environ.Env()
environ.Env.read_env()

# Flask APP
FLASK_APP = env("FLASK_APP")

# Security & Flask settings
SECRET_KEY = env("SUPERSET_SECRET_KEY")

# Database Connection
SQLALCHEMY_DATABASE_URI = f"{env('DATABASE_DIALECT')}://{env('DATABASE_USER')}:{env('DATABASE_PASSWORD')}@{env('DATABASE_HOST')}:{env('DATABASE_PORT')}/{env('DATABASE_DB')}"
SQLALCHEMY_TRACK_MODIFICATIONS = env("SQLALCHEMY_TRACK_MODIFICATIONS")

# Public URL
SUPERSET_PUBLIC_URL = env("SUPERSET_PUBLIC_URL")


# Web Server Settings
ENABLE_PROXY_FIX = env.bool("SUPERSET_WEBSERVER_ENABLE_PROXY_FIX")
TALISMAN_ENABLED = env.bool("TALISMAN_ENABLED")
WEBSERVER_ADDRESS = env("SUPERSET_WEBSERVER_HOST")
WEBSERVER_PORT = env("SUPERSET_WEBSERVER_PORT")
WTF_CSRF_ENABLED = env.bool("WTF_CSRF_ENABLED")
SESSION_COOKIE_HTTPONLY = env.bool("SESSION_COOKIE_HTTPONLY")
WEBSERVER_TIMEOUT = env("SUPERSET_WEBSERVER_TIMEOUT")
SESSION_COOKIE_SAMESITE = env("SESSION_COOKIE_SAMESITE")
SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE")
WTF_CSRF_TIME_LIMIT = env.int("WTF_CSRF_TIME_LIMIT")

# Public URL
SUPERSET_PUBLIC_URL = env("SUPERSET_PUBLIC_URL")
PROXY_FIX_CONFIG = {"x_for": 1, "x_proto": 1, "x_host": 1, "x_port": 1, "x_prefix": 0}

# CORS_OPTIONS = {
#     "origins": env.list("ORIGINS"),
#     "supports_credentials": True,
#     "allow_headers": ["Content-Type", "X-CSRFToken", "Authorization"],
#     "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
# }

FORCE_HTTPS = env.bool("FORCE_HTTPS")


LOG_LEVEL = getattr(logging, env("LOG_LEVEL").upper(), None)
