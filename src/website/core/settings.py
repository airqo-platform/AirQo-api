import os
import sys
import dj_database_url
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
# Adjusting BASE_DIR to point to the backend folder level
BASE_DIR = Path(__file__).resolve().parent.parent

# Add the apps directory to the Python path
sys.path.append(os.path.join(BASE_DIR, 'apps'))

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', 'False') == 'True'

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '').split(',')

# Application definition
INSTALLED_APPS = [
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
    'apps.event',
    'apps.cleanair',
    'apps.africancities',
    'apps.publications',
    'apps.press',
    'apps.impact',
    'apps.highlights',
    'apps.career',
    'apps.FAQ',
    'apps.partners',
    'apps.externalTeam',
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

# Handle CORS_ALLOWED_ORIGINS
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv(
    'CORS_ALLOWED_ORIGINS', '').split(',')]

# Handle CORS_ORIGIN_REGEX_WHITELIST
CORS_ORIGIN_REGEX_WHITELIST = [regex.strip() for regex in os.getenv(
    'CORS_ORIGIN_REGEX_WHITELIST', '').split(',')]

# Handle CSRF_TRUSTED_ORIGINS
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in os.getenv(
    'CSRF_TRUSTED_ORIGINS', '').split(',')]

# Only allow CSRF cookie over HTTPS (recommended for production)
if DEBUG:
    CSRF_COOKIE_SECURE = False
else:
    CSRF_COOKIE_SECURE = True


# Root URL configuration
ROOT_URLCONF = 'core.urls'

# Template configuration
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
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
if DEBUG:
    DATABASES = {
        'default': {
            'ENGINE': os.getenv('DATABASE_ENGINE', 'django.db.backends.sqlite3'),
            'NAME': BASE_DIR / os.getenv('DATABASE_NAME', 'db.sqlite3'),
        }
    }
else:
    DATABASES = {
        'default': dj_database_url.config(default=os.getenv('DATABASE_URL'))
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

# Static files configuration
# Point STATICFILES_DIRS to the correct path for the 'static' folder inside 'backend'
STATIC_URL = '/static/'
STATICFILES_DIRS = [os.path.join(BASE_DIR, 'static')]
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Media files configuration
if DEBUG:
    MEDIA_URL = '/media/'
    MEDIA_ROOT = os.path.join(BASE_DIR, 'assets')
    DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
else:
    CLOUDINARY_STORAGE = {
        'CLOUD_NAME': os.getenv('CLOUDINARY_CLOUD_NAME'),
        'API_KEY': os.getenv('CLOUDINARY_API_KEY'),
        'API_SECRET': os.getenv('CLOUDINARY_API_SECRET'),
        'SECURE': True,
    }
    DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'
    MEDIA_URL = '/media/'

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
    return os.path.join(MEDIA_URL, file_name)


def cloudinary_file_upload(file):
    from django.core.files.storage import default_storage
    file_name = default_storage.save(
        f'website/uploads/quill_uploads/{file.name}', file)
    return MEDIA_URL + file_name


# Set the appropriate upload handler
if DEBUG:
    QUILL_UPLOAD_HANDLER = local_file_upload
else:
    QUILL_UPLOAD_HANDLER = cloudinary_file_upload

# Debug logging
if DEBUG:
    print(f"Debug mode is: {DEBUG}")
    print(f"Media files are stored in: {MEDIA_ROOT}")
else:
    print("Production mode is ON")
