import os
from pathlib import Path
import sys

import dj_database_url
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Add the apps directory to the Python path
sys.path.append(str(BASE_DIR / 'apps'))


def parse_env_list(env_var, default=""):
    """
    Parses a comma-separated string from an environment variable and trims whitespace.
    """
    raw_value = os.getenv(env_var, default)
    return [v.strip() for v in raw_value.split(',') if v.strip()]


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('SECRET_KEY')
if not SECRET_KEY:
    raise ValueError("The SECRET_KEY environment variable is not set.")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', 'False').lower() in ['true', '1', 't']

ALLOWED_HOSTS = parse_env_list("ALLOWED_HOSTS")

# Application definition
INSTALLED_APPS = [
    # Django default apps
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
    'rest_framework',
    'django_extensions',
    'nested_admin',
    'drf_yasg',
    'django_quill',

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

# CORS Configuration
CORS_ORIGIN_ALLOW_ALL = False
CORS_ALLOWED_ORIGINS = parse_env_list("CORS_ALLOWED_ORIGINS")
CORS_ORIGIN_REGEX_WHITELIST = parse_env_list("CORS_ORIGIN_REGEX_WHITELIST")
CSRF_TRUSTED_ORIGINS = parse_env_list("CSRF_TRUSTED_ORIGINS")


# Only allow CSRF cookie over HTTPS in production
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True

# Root URL configuration
ROOT_URLCONF = 'core.urls'

# Template configuration
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# WSGI Application
WSGI_APPLICATION = 'core.wsgi.application'

# Database configuration
# if DEBUG:
#     DATABASES = {
#         'default': {
#             'ENGINE': os.getenv('DATABASE_ENGINE', 'django.db.backends.sqlite3'),
#             'NAME': BASE_DIR / os.getenv('DATABASE_NAME', 'db.sqlite3'),
#         }
#     }
# else:
#     DATABASE_URL = os.getenv('DATABASE_URL')
#     if not DATABASE_URL:
#         raise ValueError(
#             "The DATABASE_URL environment variable is not set in production.")
#     DATABASES = {
#         'default': dj_database_url.parse(DATABASE_URL, conn_max_age=600, ssl_require=True)
#     }
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError(
        "The DATABASE_URL environment variable is not set in production.")
DATABASES = {
    'default': dj_database_url.parse(DATABASE_URL, conn_max_age=600, ssl_require=True)
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = os.getenv('LANGUAGE_CODE', 'en-us')
TIME_ZONE = os.getenv('TIME_ZONE', 'UTC')
USE_I18N = True
USE_L10N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/website/static/'

# Define where `collectstatic` will output collected static files
STATIC_ROOT = BASE_DIR / 'staticfiles'

# Additional locations for app-specific static files
STATICFILES_DIRS = [BASE_DIR / 'static']

# Use WhiteNoise for serving static files in production
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Media files (Uploaded files)
MEDIA_URL = '/media/' if DEBUG else f'https://res.cloudinary.com/{os.getenv("CLOUDINARY_CLOUD_NAME")}/'
MEDIA_ROOT = BASE_DIR / 'assets' if DEBUG else None

if DEBUG:
    # Local file storage for media
    DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
else:
    # Validate Cloudinary settings for production
    CLOUDINARY_CLOUD_NAME = os.getenv('CLOUDINARY_CLOUD_NAME')
    CLOUDINARY_API_KEY = os.getenv('CLOUDINARY_API_KEY')
    CLOUDINARY_API_SECRET = os.getenv('CLOUDINARY_API_SECRET')

    if not all([CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET]):
        raise ValueError(
            "Cloudinary environment variables are not fully set in production."
        )

    CLOUDINARY_STORAGE = {
        'CLOUD_NAME': CLOUDINARY_CLOUD_NAME,
        'API_KEY': CLOUDINARY_API_KEY,
        'API_SECRET': CLOUDINARY_API_SECRET,
        'SECURE': True,
    }

    DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'


# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django Rest Framework settings
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
}

# Quill Editor Configuration
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

# Custom upload handlers


def local_file_upload(file):
    from django.core.files.storage import default_storage
    file_name = default_storage.save(f'quill_uploads/{file.name}', file)
    return f"{MEDIA_URL}{file_name}"


def cloudinary_file_upload(file):
    from django.core.files.storage import default_storage
    file_name = default_storage.save(
        f'website/uploads/quill_uploads/{file.name}', file)
    return f"{MEDIA_URL}{file_name}"


# Set the appropriate upload handler
QUILL_UPLOAD_HANDLER = local_file_upload if DEBUG else cloudinary_file_upload

# Debug logging
if DEBUG:
    print(f"Debug mode is: {DEBUG}")
    print(f"Media files are stored in: {MEDIA_ROOT}")
else:
    print("Production mode is ON")


# Django Admin Configuration
LOGIN_URL = '/website/admin/login/'

SWAGGER_SETTINGS = {
    'LOGIN_URL': '/website/admin/login/',
    'LOGOUT_URL': '/website/admin/logout/',
    'USE_SESSION_AUTH': True,
    'SECURITY_DEFINITIONS': {
        'basic': {
            'type': 'basic'
        }
    },
}
