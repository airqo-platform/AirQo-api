from controllers.predict_faults import fault_detection
from flask import Flask
import logging
import os
from flask_cors import CORS
from flask_pymongo import PyMongo
from dotenv import load_dotenv
load_dotenv()


_logger = logging.getLogger(__name__)

app = Flask(__name__)

# Allow cross-brower resource sharing
CORS(app)

app.config["MONGO_URI"] = os.getenv("MONGO_URI")
mongo = PyMongo(app)

# register blueprints
app.register_blueprint(fault_detection)