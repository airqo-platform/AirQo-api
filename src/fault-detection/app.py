from controllers.predict_faults import fault_detection_bp
from flask import Flask
import logging
import os
from flask_cors import CORS
from flask_pymongo import PyMongo
from dotenv import load_dotenv

load_dotenv()

_logger = logging.getLogger(__name__)

app = Flask(__name__)

CORS(app)

app.config["MONGO_URI"] = os.getenv("MONGO_URI")
mongo = PyMongo(app)

app.register_blueprint(fault_detection_bp)
