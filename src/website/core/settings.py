import os
import sys
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

# ---------------------------------------------------------
# Load Environment Variables
# ---------------------------------------------------------
load_dotenv()

# ---------------------------------------------------------
# Base Directory & Python Path
# ---------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR / 'apps'))

# ---------------------------------------------------------
# Environment Variable Helpers
# ---------------------------------------------------------


def parse_env_list(env_var: str, default: str = "") -> list:
    """
    Convert a comma-separated list in an env var to a Python list.
    """
    raw_value = os.getenv(env_var, default)
    return [item.strip() for item in raw_value.split(',') if item.strip()]


def get_env_bool(env_var: str, default: bool = False) -> bool:
    """
    Convert an environment variable to boolean.
    """
    return os.getenv(env_var, str(default)).lower() in ['true', '1', 't', 'yes']


def require_env_var(env_var: str) -> str:
    """
    Ensure an environment variable is set. Raise ValueError if not.
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

ALLOWED_HOSTS = parse_env_list('ALLOWED_HOSTS', default='localhost,127.0.0.1')

# ---------------------------------------------------------
# Applications
# ---------------------------------------------------------
INSTALLED_APPS = [
    # Django Defaults
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party Apps
    'corsheaders',
    'cloudinary',
    'cloudinary_storage',
    'django_cleanup.apps.CleanupConfig',
    'rest_framework',
    'django_extensions',
    'nested_admin',
    'drf_yasg',
    'django_quill',

    # Custom Apps
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
    'corsheaders.middleware.CorsMiddleware',
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
CORS_ALLOWED_ORIGINS = parse_env_list('CORS_ALLOWED_ORIGINS')
CORS_ALLOWED_ORIGIN_REGEXES = parse_env_list('CORS_ORIGIN_REGEX_WHITELIST')
CSRF_TRUSTED_ORIGINS = parse_env_list('CSRF_TRUSTED_ORIGINS')

# If no CORS settings provided, consider defaulting to empty lists
CORS_ALLOWED_ORIGINS = CORS_ALLOWED_ORIGINS if CORS_ALLOWED_ORIGINS else []
CORS_ALLOWED_ORIGIN_REGEXES = CORS_ALLOWED_ORIGIN_REGEXES if CORS_ALLOWED_ORIGIN_REGEXES else []

# Security cookies
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
if DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            ssl_require=True
        )
    }
else:
    DATABASES = {
        'default': {
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
USE_TZ = True

# ---------------------------------------------------------
# Static and Media Files
# ---------------------------------------------------------
STATIC_URL = '/website/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Cloudinary Configuration
CLOUDINARY_STORAGE = {
    'CLOUD_NAME': require_env_var('CLOUDINARY_CLOUD_NAME'),
    'API_KEY': require_env_var('CLOUDINARY_API_KEY'),
    'API_SECRET': require_env_var('CLOUDINARY_API_SECRET'),
    'SECURE': True,
    'TIMEOUT': 600,
}
DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'

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
