from controllers.prediction import ml_app, cache
from flask import Flask
import logging
import os
import sys
from flask_cors import CORS
from dotenv import load_dotenv
from flask_pymongo import PyMongo
from apscheduler.schedulers.background import BackgroundScheduler
from google.cloud import storage
from os.path import join, isdir, isfile, basename
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

    return app

application = create_app(os.getenv('FLASK_ENV'))

if __name__ == '__main__':
    application.run(debug=True)



