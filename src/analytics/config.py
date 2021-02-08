from pathlib import Path
from dotenv import load_dotenv
from decouple import config as env_var

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
    "production": ProductionConfig
}
