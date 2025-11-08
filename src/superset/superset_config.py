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

# Web Server Settings
ENABLE_PROXY_FIX = env.bool("SUPERSET_WEBSERVER_ENABLE_PROXY_FIX")
TALISMAN_ENABLED = env.bool("TALISMAN_ENABLED")
WEBSERVER_ADDRESS = env("SUPERSET_WEBSERVER_HOST")
WEBSERVER_PORT = env("SUPERSET_WEBSERVER_PORT")
WTF_CSRF_ENABLED = env.bool("WTF_CSRF_ENABLED")
SESSION_COOKIE_HTTPONLY = env.bool("SESSION_COOKIE_HTTPONLY")
WEBSERVER_TIMEOUT = env("SUPERSET_WEBSERVER_TIMEOUT")
SESSION_COOKIE_DOMAIN = env("SESSION_COOKIE_DOMAIN")
SESSION_COOKIE_SAMESITE = env("SESSION_COOKIE_SAMESITE")
SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE")
WTF_CSRF_TIME_LIMIT = env.int("WTF_CSRF_TIME_LIMIT")

PREFERRED_URL_SCHEME = env("PREFERRED_URL_SCHEME")
PROXY_FIX_CONFIG = {"x_for": 1, "x_proto": 1, "x_host": 1, "x_port": 1}

# Public URL
SUPERSET_PUBLIC_URL = env("SUPERSET_PUBLIC_URL")


FORCE_HTTPS = env.bool("FORCE_HTTPS")

TALISMAN_CONFIG = {
    "content_security_policy": {
        "base-uri": ["'self'"],
        "default-src": ["'self'"],
        "worker-src": ["'self'", "blob:"],
        "connect-src": [
            "'self'",
            "https://api.mapbox.com",
            "https://events.mapbox.com",
        ],
        "object-src": "'none'",
        "style-src": [
            "'self'",
            "'unsafe-inline'",
        ],
        "script-src": ["'self'", "'strict-dynamic'"],
    },
    "content_security_policy_nonce_in": ["script-src"],
    "force_https": FORCE_HTTPS,
    "session_cookie_secure": SESSION_COOKIE_SECURE,
}

LOG_LEVEL = getattr(logging, env("LOG_LEVEL").upper(), None)
