from controllers.calibrate import calibrate_bp
from flask import Flask
import logging
import os
from flask_cors import CORS
from flask_pymongo import PyMongo
from dotenv import load_dotenv
load_dotenv()

# import blue prints

_logger = logging.getLogger(__name__)

app = Flask(__name__)

# Allow cross-brower resource sharing
CORS(app)

app.config["MONGO_URI"] = os.getenv("MONGO_DEV_URI")
mongo = PyMongo(app)

# register blueprints
app.register_blueprint(calibrate_bp)
