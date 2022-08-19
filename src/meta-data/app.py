from controllers.extract import extract_bp
from flask import Flask
import logging
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

_logger = logging.getLogger(__name__)

app = Flask(__name__)

CORS(app)

app.register_blueprint(extract_bp)
