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
# Installed Apps
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
    'drf_spectacular',
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

# Ensure no trailing slashes and correct schemes
CORS_ALLOWED_ORIGINS = [origin.rstrip('/') for origin in CORS_ALLOWED_ORIGINS]
CORS_ALLOWED_ORIGIN_REGEXES = [regex.rstrip(
    '/') for regex in CORS_ALLOWED_ORIGIN_REGEXES]
CSRF_TRUSTED_ORIGINS = [origin.rstrip('/') for origin in CSRF_TRUSTED_ORIGINS]

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
    # Add PostgreSQL-specific connection options
    if 'postgresql' in DATABASE_URL:
        DATABASES['default']['OPTIONS'] = {
            'sslmode': 'require',
        }
    elif 'mysql' in DATABASE_URL:
        DATABASES['default']['OPTIONS'] = {
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
            'charset': 'utf8mb4',
            'autocommit': True,
        }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
            'OPTIONS': {
                'timeout': 600,
            }
        }
    }

# ---------------------------------------------------------
# Cache Configuration
# ---------------------------------------------------------
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'airqo-website-cache',
        'TIMEOUT': 300,  # 5 minutes default
        'OPTIONS': {
            'MAX_ENTRIES': 1000,
            'CULL_FREQUENCY': 3,
        }
    }
}

# Cache time for different types of data
CACHE_TTL = {
    'default': 300,      # 5 minutes
    'static_content': 3600,  # 1 hour for relatively static content
    'dynamic_content': 60,   # 1 minute for dynamic content
    'list_views': 300,       # 5 minutes for list views
    'detail_views': 600,     # 10 minutes for detail views
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
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '1000/day',
        'user': '5000/day'
    }
}

# ---------------------------------------------------------
# DRF Spectacular (OpenAPI 3.0) Settings
# ---------------------------------------------------------
SPECTACULAR_SETTINGS = {
    'TITLE': 'AirQo Website API',
    'DESCRIPTION': 'API documentation for AirQo Website - providing access to air quality data, events, team information, publications, and more.',
    'VERSION': '2.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'SCHEMA_PATH_PREFIX': r'/website/api/v[0-9]',
    'SERVERS': [
        {'url': 'http://127.0.0.1:8000', 'description': 'Development server'},
        {'url': 'https://platform.airqo.net',
            'description': 'Production server'},
    ],
    'TAGS': [
        {'name': 'v1', 'description': 'Legacy API endpoints (v1)'},
        {'name': 'v2',
            'description': 'Enhanced API endpoints (v2) with improved performance and features'},
        {'name': 'Team', 'description': 'Team member and biography endpoints'},
        {'name': 'Events', 'description': 'Event management and listing endpoints'},
        {'name': 'Publications', 'description': 'Research publications and resources'},
        {'name': 'Clean Air', 'description': 'Clean air resources and forum events'},
        {'name': 'Partners', 'description': 'Organization partners and descriptions'},
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

# ---------------------------------------------------------
# File Upload Settings
# ---------------------------------------------------------
# Increase these values to handle larger uploads (up to 25MB)
FILE_UPLOAD_MAX_MEMORY_SIZE = 26214400  # 25 MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 26214400  # 25 MB
FILE_UPLOAD_TEMP_DIR = None  # Use system default temp directory
FILE_UPLOAD_PERMISSIONS = 0o644
FILE_UPLOAD_DIRECTORY_PERMISSIONS = 0o755

# Additional upload configurations
DATA_UPLOAD_MAX_NUMBER_FIELDS = 1000  # Maximum number of fields in form data
DATA_UPLOAD_MAX_NUMBER_FILES = 100    # Maximum number of files in upload

# ---------------------------------------------------------
# SSL and Proxy Settings (if behind a reverse proxy)
# ---------------------------------------------------------
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

# ---------------------------------------------------------
# Logging Configuration
# ---------------------------------------------------------
LOG_DIR = BASE_DIR / 'logs'
LOG_DIR.mkdir(exist_ok=True)  # Ensure log directory exists

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    # Formatters
    'formatters': {
        'verbose': {
            'format': '[%(asctime)s] %(levelname)s %(name)s [%(filename)s:%(lineno)d] %(message)s',
            'datefmt': '%Y-%m-%d %H:%M:%S'
        },
        'simple': {
            'format': '%(levelname)s %(message)s'
        },
    },
    # Handlers
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
            'level': 'DEBUG' if DEBUG else 'INFO',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': LOG_DIR / 'django.log',
            'formatter': 'verbose',
            'level': 'INFO',
        },
        'error_file': {
            'class': 'logging.FileHandler',
            'filename': LOG_DIR / 'django_errors.log',
            'formatter': 'verbose',
            'level': 'ERROR',
        },
    },
    # Loggers
    'loggers': {
        # Django Logs
        'django': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'INFO',
            'propagate': True,
        },
        # Cloudinary Logs
        'cloudinary': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'INFO',
            'propagate': True,
        },
        # Event App Logs
        'apps.event': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        # CleanAir App Logs
        'apps.cleanair': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        # AfricanCities App Logs
        'apps.africancities': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        # Publications App Logs
        'apps.publications': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        # Press App Logs
        'apps.press': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        # Impact App Logs
        'apps.impact': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        # FAQs App Logs
        'apps.faqs': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        # Highlights App Logs
        'apps.highlights': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        # Career App Logs
        'apps.career': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        # Partners App Logs
        'apps.partners': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        # Board App Logs
        'apps.board': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        # Team App Logs
        'apps.team': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        # ExternalTeams App Logs
        'apps.externalteams': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
    }
}
