import logging

from dotenv import load_dotenv
from flasgger import Swagger, LazyJSONEncoder
from flask import Flask
from flask_cors import CORS

from api.controllers.extract import extract_bp
from config import Config

load_dotenv()

_logger = logging.getLogger(__name__)

app = Flask(__name__)
app.json_encoder = LazyJSONEncoder
swagger = Swagger(app, template=Config.SWAGGER_TEMPLATE, config=Config.SWAGGER_CONFIG)
CORS(app)

app.register_blueprint(extract_bp)
