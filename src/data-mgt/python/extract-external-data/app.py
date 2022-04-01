from controllers.extract import extract_bp
from flask import Flask
import logging
import os
from flask_cors import CORS
from dotenv import load_dotenv
load_dotenv()

# import blue prints

_logger = logging.getLogger(__name__)

app = Flask(__name__)

# Allow cross-brower resource sharing
CORS(app)

# register blueprints
app.register_blueprint(extract_bp)
