import logging
import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
from flask_pymongo import PyMongo

from config import constants
from controllers.prediction import cache, ml_app
from flask_compress import Compress

load_dotenv()

_logger = logging.getLogger(__name__)

mongo = PyMongo()


def create_app(environment):
    app = Flask(__name__)
    app.config.from_object(constants.app_config[environment])
    cache.init_app(app)
    mongo.init_app(app)
    CORS(app)
    app.register_blueprint(ml_app)
    Compress(app)

    return app


application = create_app(os.getenv('FLASK_ENV'))

if __name__ == '__main__':
    application.run(debug=True)
