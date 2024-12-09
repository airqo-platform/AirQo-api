import os
import sys
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

# ---------------------------------------------------------
# Load Environment Variables from .env
# ---------------------------------------------------------
load_dotenv()

# ---------------------------------------------------------
# Base Directory and Python Path Adjustments
# ---------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR / 'apps'))  # Allow referencing apps directly

# ---------------------------------------------------------
# Helper Functions for Environment Variables
# ---------------------------------------------------------


def parse_env_list(env_var: str, default: str = "") -> list:
    """
    Parse a comma-separated string from an environment variable into a list.
    Trims whitespace and ignores empty entries.
    """
    raw_value = os.getenv(env_var, default)
    return [item.strip() for item in raw_value.split(',') if item.strip()]


def get_env_bool(env_var: str, default: bool = False) -> bool:
    """
    Convert an environment variable to a boolean.
    Accepts 'true', '1', 't' (case-insensitive) as True.
    """
    return os.getenv(env_var, str(default)).lower() in ['true', '1', 't']


def require_env_var(env_var: str) -> str:
    """
    Ensure an environment variable is set. Raise an error if not set.
    """
    value = os.getenv(env_var)
    if not value:
        raise ValueError(f"The {env_var} environment variable is not set.")
    return value


# ---------------------------------------------------------
# Core Settings
# ---------------------------------------------------------
SECRET_KEY = require_env_var('SECRET_KEY')
DEBUG = get_env_bool('DEBUG', default=False)

# ALLOWED_HOSTS = parse_env_list("ALLOWED_HOSTS")
ALLOWED_HOSTS = ['*']

# ---------------------------------------------------------
# Application Definitions
# ---------------------------------------------------------
INSTALLED_APPS = [
    # Django defaults
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party apps
    'corsheaders',
    'cloudinary',
    'cloudinary_storage',
    'django_cleanup.apps.CleanupConfig',
    'rest_framework',
    'django_extensions',
    'nested_admin',
    'drf_yasg',
    'django_quill',  # Re-added django_quill

    # Custom apps
    'apps.externalteams',
    'apps.event',
    'apps.cleanair',
    'apps.africancities',
    'apps.publications',
    'apps.press',
    'apps.impact',
    'apps.faqs',
    'apps.highlights',
    'apps.career',
    'apps.partners',
    'apps.board',
    'apps.team',
]

# ---------------------------------------------------------
# Middleware
# ---------------------------------------------------------
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Must be first
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# ---------------------------------------------------------
# CORS and CSRF Configuration
# ---------------------------------------------------------
if DEBUG:
    # Allow all CORS origins during development
    CORS_ORIGIN_ALLOW_ALL = True
    CORS_ALLOWED_ORIGINS = []
    CORS_ORIGIN_REGEX_WHITELIST = []

    # Allow all CSRF origins during development
    CSRF_TRUSTED_ORIGINS = [
        "https://website-trigger-3-website-preview-w7kzhvlewq-ew.a.run.app",
    ]

    # Optionally, you can add more relaxed settings
    # For example, allow specific subdomains or ports if needed
else:
    # Restrict CORS origins in production
    CORS_ORIGIN_ALLOW_ALL = False
    CORS_ALLOWED_ORIGINS = [
        "https://staging-dot-airqo-frontend.appspot.com",
        "https://staging.airqo.net",
        "https://airqo.net",
        "https://airqo.africa",
        "https://airqo.org",
        "https://airqo.mak.ac.ug",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "https://staging-platform.airqo.net",
        "https://staging-analytics.airqo.net",
        "https://analytics.airqo.net",
        "https://platform.airqo.net",
    ]
    CORS_ORIGIN_REGEX_WHITELIST = [
        # Matches subdomains under airqo.net, airqo.africa, airqo.org, airqo.io
        r"^https://[a-zA-Z0-9_\-]+\.airqo\.(net|africa|org|io)$",
        # Matches airqo.africa, airqo.org, and airqo.mak.ac.ug
        r"^https://airqo\.(africa|org|mak\.ac\.ug)$",
        # Matches staging-dot-airqo-frontend.appspot.com
        r"^https://staging-dot-airqo-frontend\.appspot\.com$",
        r"^https://staging-platform\.airqo\.net$",  # Matches staging-platform.airqo.net
        # Matches staging-analytics.airqo.net
        r"^https://staging-analytics\.airqo\.net$",
        r"^https://analytics\.airqo\.net$",  # Matches analytics.airqo.net
        r"^https://platform\.airqo\.net$",  # Matches platform.airqo.net
        # Matches any subpath under https://platform.airqo.net/website/admin
        r"^https://platform\.airqo\.net/website/admin.*$",
        # Matches any subpath under https://staging-platform.airqo.net/website/admin
        r"^https://staging-platform\.airqo\.net/website/admin.*$",
    ]

    # Trust specific origins for CSRF protection in production
    # CSRF_TRUSTED_ORIGINS = parse_env_list("CSRF_TRUSTED_ORIGINS")
    CSRF_TRUSTED_ORIGINS = [
        "https://staging-dot-airqo-frontend.appspot.com",
        "https://staging.airqo.net",
        "https://airqo.net",
        "https://airqo.africa",
        "https://airqo.org",
        "https://airqo.mak.ac.ug",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "https://*.cloudshell.dev",
        "https://staging-platform.airqo.net",
        "https://staging-analytics.airqo.net",
        "https://analytics.airqo.net",
        "https://platform.airqo.net",
        "https://website-trigger-3-website-preview-w7kzhvlewq-ew.a.run.app",
    ]


# Security settings
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG

# ---------------------------------------------------------
# URL and WSGI Configuration
# ---------------------------------------------------------
ROOT_URLCONF = 'core.urls'
WSGI_APPLICATION = 'core.wsgi.application'

# ---------------------------------------------------------
# Templates Configuration
# ---------------------------------------------------------
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',  # Required by django-quill
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# ---------------------------------------------------------
# Database Configuration
# ---------------------------------------------------------
DATABASE_URL = os.getenv('DATABASE_URL')

DATABASES = {
    'default': dj_database_url.parse(
        DATABASE_URL,
        conn_max_age=600,
        ssl_require=True
    ) if DATABASE_URL else {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# ---------------------------------------------------------
# Password Validation
# ---------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ---------------------------------------------------------
# Internationalization
# ---------------------------------------------------------
LANGUAGE_CODE = os.getenv('LANGUAGE_CODE', 'en-us')
TIME_ZONE = os.getenv('TIME_ZONE', 'UTC')
USE_I18N = True
USE_L10N = True
USE_TZ = True

# ---------------------------------------------------------
# Static and Media Files
# ---------------------------------------------------------
STATIC_URL = '/website/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

if DEBUG:
    # Local file storage for development
    MEDIA_URL = '/media/'
    DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
    MEDIA_ROOT = BASE_DIR / 'assets'
    print("DEBUG=True: Using local file storage for media.")
else:
    # Cloudinary setup for production
    CLOUDINARY_STORAGE = {
        'CLOUD_NAME': require_env_var('CLOUDINARY_CLOUD_NAME'),
        'API_KEY': require_env_var('CLOUDINARY_API_KEY'),
        'API_SECRET': require_env_var('CLOUDINARY_API_SECRET'),
        'SECURE': True,
        'TIMEOUT': 600,
    }

    DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'
    print("DEBUG=False: Using Cloudinary for media storage.")

# ---------------------------------------------------------
# Default Primary Key Field Type
# ---------------------------------------------------------
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ---------------------------------------------------------
# Django REST Framework Configuration
# ---------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
}

# ---------------------------------------------------------
# File Upload Limits
# ---------------------------------------------------------
# Define a constant for maximum upload size
MAX_UPLOAD_SIZE_MB = 10  # Maximum upload size in MB
MAX_UPLOAD_SIZE = MAX_UPLOAD_SIZE_MB * 1024 * 1024  # Convert to bytes

# Apply the maximum upload size to Django settings
DATA_UPLOAD_MAX_MEMORY_SIZE = MAX_UPLOAD_SIZE
FILE_UPLOAD_MAX_MEMORY_SIZE = MAX_UPLOAD_SIZE

# ---------------------------------------------------------
# Admin and Authentication Settings
# ---------------------------------------------------------
LOGIN_URL = '/website/admin/login/'

# ---------------------------------------------------------
# Swagger / DRF-YASG Settings
# ---------------------------------------------------------
SWAGGER_SETTINGS = {
    'LOGIN_URL': LOGIN_URL,
    'LOGOUT_URL': '/website/admin/logout/',
    'USE_SESSION_AUTH': True,
    'SECURITY_DEFINITIONS': {
        'basic': {
            'type': 'basic'
        }
    },
}

# ---------------------------------------------------------
# Quill Editor Configuration
# ---------------------------------------------------------
QUILL_CONFIGS = {
    'default': {
        'theme': 'snow',
        'modules': {
            'toolbar': [
                [{'header': [1, 2, 3, 4, 5, 6, False]}],
                ['bold', 'italic', 'underline', 'strike',
                    'blockquote', 'code-block'],
                [{'list': 'ordered'}, {'list': 'bullet'},
                    {'indent': '-1'}, {'indent': '+1'}],
                [{'direction': 'rtl'}],
                [{'size': ['small', False, 'large', 'huge']}],
                [{'color': []}, {'background': []}],
                [{'font': []}],
                ['link', 'image', 'video'],
                ['clean'],
            ],
            'clipboard': {'matchVisual': False},
        },
        'placeholder': 'Compose an epic...',
        'readOnly': False,
        'bounds': '#editor',
        'scrollingContainer': '#scrolling-container',
    },
}

# ---------------------------------------------------------
# Mode-Specific Logging
# ---------------------------------------------------------
if DEBUG:
    print(f"Debug mode is: {DEBUG}")
    print(f"Media files are stored in: {BASE_DIR / 'assets'}")
else:
    print("Production mode is ON")
