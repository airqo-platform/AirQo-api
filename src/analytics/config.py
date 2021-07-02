from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from decouple import config as env_var
from flasgger import LazyString

env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path, verbose=True)


class Config:
    DEBUG = False
    TESTING = False
    CSRF_ENABLED = True
    SECRET_KEY = env_var("SECRET_KEY")
    #SERVER_PORT = 5000

    CLARITY_API_BASE_URL = env_var("CLARITY_API_BASE_URL")
    CLARITY_API_KEY = env_var("CLARITY_API_KEY")

    SWAGGER = {
        "swagger": "2.0",
        "info": {
            "title": "Analytics API",
            "description": "API docs for analytics AirQO microservice",
            "version": "0.0.1"
        },
        "schemes": [
            "http",
            "https"
        ],
        'footer_text': LazyString(lambda: f'&copy; AirQo. {datetime.now().year}'),
        'head_text': '<style>.top_text{color: red;}</style>',
        'doc_expansion': "list",
        'ui_params': {
            'apisSorter': 'alpha',
            'operationsSorter': 'alpha',
        },
        'ui_params_text': '''{
            "operationsSorter" : (a, b) => a.get("path").localeCompare(b.get("path"))
        }'''
    }


class ProductionConfig(Config):
    DEBUG = False
    MONGO_URI = env_var("MONGO_GCE_URI")
    DB_NAME = env_var("MONGO_PROD")


class DevelopmentConfig(Config):
    DEVELOPMENT = True
    DEBUG = True
    MONGO_URI = env_var("MONGO_LOCAL_URI")
    DB_NAME = env_var("MONGO_DEV")


class TestingConfig(Config):
    TESTING = True
    DEBUG = True
    MONGO_URI = env_var("MONGO_GCE_URI")
    DB_NAME = env_var("MONGO_STAGE")


config = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "staging": TestingConfig,
    "production": ProductionConfig
}
