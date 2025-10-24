import environ
import redis

env = environ.Env()
environ.Env.read_env()

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
APP_ROOT = env("SUPERSET_APP_ROOT")
SESSION_COOKIE_HTTPONLY = env.bool("SESSION_COOKIE_HTTPONLY")
WEBSERVER_TIMEOUT = env("SUPERSET_WEBSERVER_TIMEOUT")
# SESSION_COOKIE_DOMAIN = env("SESSION_COOKIE_DOMAIN")
SESSION_COOKIE_SAMESITE = env("SESSION_COOKIE_SAMESITE")
SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE")
WTF_CSRF_TIME_LIMIT = env.int("WTF_CSRF_TIME_LIMIT")

SESSION_SERVER_SIDE = env.bool("SESSION_SERVER_SIDE")
SESSION_TYPE = env("SESSION_TYPE")
SESSION_REDIS = redis.from_url(env("CACHE_REDIS_URL"))

# Public URL
SUPERSET_PUBLIC_URL = env("SUPERSET_PUBLIC_URL")

# Cache Settings
CACHE_CONFIG = {
    "CACHE_TYPE": env("CACHE_TYPE"),
    "CACHE_DEFAULT_TIMEOUT": env("CACHE_DEFAULT_TIMEOUT"),
    "CACHE_KEY_PREFIX": env("CACHE_KEY_PREFIX"),
    "CACHE_REDIS_URL": env("CACHE_REDIS_URL"),
}

# Flask APP
FLASK_APP = env("FLASK_APP")

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
    "force_https": False,
    "session_cookie_secure": False,
}
