import logging
import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
from flask_pymongo import PyMongo
from geoalchemy2 import Geometry

from config import constants
from flask_caching import Cache
from flask_sqlalchemy import SQLAlchemy

app_configuration = constants.app_config.get(os.getenv("FLASK_ENV"))
load_dotenv()

_logger = logging.getLogger(__name__)

mongo = PyMongo()

cache = Cache(
    config={
        "CACHE_TYPE": "redis",
        "CACHE_REDIS_HOST": app_configuration.REDIS_SERVER,
        "CACHE_REDIS_PORT": os.getenv("REDIS_PORT"),
        "CACHE_REDIS_URL": f"redis://{app_configuration.REDIS_SERVER}:{os.getenv('REDIS_PORT')}",
    }
)


def create_app(environment):
    from controllers.prediction import ml_app

    app = Flask(__name__)
    app.config.from_object(constants.app_config[environment])
    cache.init_app(app)
    mongo.init_app(app)
    app.config["SQLALCHEMY_DATABASE_URI"] = app_configuration.POSTGRES_CONNECTION_URL
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    CORS(app)
    app.register_blueprint(ml_app)

    return app


application = create_app(os.getenv("FLASK_ENV"))
postgres_db = SQLAlchemy(application)


class Predictions(postgres_db.Model):
    parish = postgres_db.Column(postgres_db.String(100), primary_key=True)
    pm2_5 = postgres_db.Column(postgres_db.Float())
    geometry = postgres_db.Column(Geometry("POLYGON"))
    timestamp = postgres_db.Column(postgres_db.DateTime())


if __name__ == "__main__":
    application.run(debug=True)
