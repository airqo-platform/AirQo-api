"""Module for creating the flask app"""

# System libraries
from api.utils.utils import limiter

# Third-Party libraries
from flasgger import Swagger
from flask import Flask, jsonify
from flask_caching import Cache
from flask_cors import CORS
from flask_excel import init_excel
from flask_restx import Api, Namespace
from marshmallow import ValidationError as MarshmallowValidationError

# middlewares
from api.middlewares import middleware_blueprint
from api.middlewares.base_validator import ValidationError

# Config
from config import (
    CONFIGURATIONS,
    API_V2_BASE_URL,
    API_V3_BASE_URL,
    API_V2_BASE_INTERNAL_URL,
    BaseConfig,
)

BaseConfig.init_logging()

rest_api = Api(doc=False)
rest_api_v2 = Namespace(name="v2", description="API version 2", path=API_V2_BASE_URL)
rest_api_v3 = Namespace(name="v3", description="API version 3", path=API_V3_BASE_URL)

rest_api.add_namespace(rest_api_v2)
rest_api.add_namespace(rest_api_v3)
cache = Cache()


def initialize_blueprints(application):
    """Initialize error handlers"""

    application.register_blueprint(middleware_blueprint)


def create_app(rest_api, config=CONFIGURATIONS):
    """creates a flask app object from a config object"""

    app = Flask(__name__)
    app.config.from_object(config)
    rest_api.init_app(app)
    limiter.init_app(app)
    cache.init_app(app)
    init_excel(app)
    CORS(app)
    Swagger(app)

    initialize_blueprints(app)

    import api.views

    return app


@rest_api.errorhandler(MarshmallowValidationError)
@middleware_blueprint.app_errorhandler(MarshmallowValidationError)
def handle_marshmallow_exception(error):
    """Error handler called when a marshmallow ValidationError is raised"""

    error_message = {
        "message": "An error occurred",
        "status": "error",
        "errors": error.messages,
    }
    return jsonify(error_message), 400


@rest_api.errorhandler(ValidationError)
@middleware_blueprint.app_errorhandler(ValidationError)
def handle_exception(error):
    """Error handler called when a ValidationError is raised"""

    return jsonify(error.error), 400
