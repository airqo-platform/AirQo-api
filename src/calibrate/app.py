from calibrate import calibrate_bp
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

# Allow a full 20 MiB CSV plus the small amount of multipart/form-data
# metadata added by browsers and API clients. The file itself is checked
# against the exact limit in the upload endpoint.
app.config["MAX_CONTENT_LENGTH"] = 21 * 1024 * 1024

# Allow cross-brower resource sharing
CORS(app)

app.config["MONGO_URI"] = os.getenv("MONGO_URI")
mongo = PyMongo(app)

# register blueprints
app.register_blueprint(calibrate_bp)


@app.errorhandler(413)
def request_too_large(_error):
    return {
        "message": "The uploaded CSV file cannot exceed 20 MB.",
        "success": False,
    }, 413
