import logging
import traceback

from dotenv import load_dotenv
from flasgger import Swagger, LazyJSONEncoder
from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import NotFound

from api.controllers.extract import extract_bp_v1, extract_bp_v2
from config import Config

load_dotenv()

_logger = logging.getLogger(__name__)

app = Flask(__name__)
app.json_encoder = LazyJSONEncoder
swagger = Swagger(app, template=Config.SWAGGER_TEMPLATE, config=Config.SWAGGER_CONFIG)
CORS(app)

app.register_blueprint(extract_bp_v1)
app.register_blueprint(extract_bp_v2)


@app.errorhandler(Exception)
def handle_exception(error):
    traceback.print_exc()
    print(error)
    return jsonify({"message": "Error occurred. Contact support"}), 500


@app.errorhandler(NotFound)
def handle_404_exception(error):
    print(error)
    return jsonify({"message": "Requested Url not found on this service"}), 404
