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

app = Flask(__name__)
CORS(app)
cache.init_app(app)

app.config["MONGO_URI"] = os.getenv("MONGO_URI")
mongo = PyMongo(app)

app.register_blueprint(ml_app)

if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
