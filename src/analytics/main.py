"""Module for creating the flask app"""

# System libraries

# Third-Party libraries
from flasgger import Swagger
from flask import Flask, jsonify
from flask_excel import init_excel
from flask_restx import Api
from flask_caching import Cache
from flask_cors import CORS
from marshmallow import ValidationError as MarshmallowValidationError

# middlewares
from api.middlewares import middleware_blueprint
from api.middlewares.base_validator import ValidationError

# Config
from config import BASE_URL, CONFIGURATIONS

rest_api = Api(prefix=BASE_URL, doc=False)
cache = Cache()


def initialize_blueprints(application):
    """Initialize error handlers"""

    application.register_blueprint(middleware_blueprint)


def create_app(rest_api, config=CONFIGURATIONS):
    """creates a flask app object from a config object"""

    app = Flask(__name__)
    app.config.from_object(config)

    rest_api.init_app(app)
    cache.init_app(app)
    init_excel(app)
    CORS(app)
    Swagger(app)

    # Initialize error handlers
    initialize_blueprints(app)

    # import views
    import api.views

    return app


@rest_api.errorhandler(MarshmallowValidationError)
@middleware_blueprint.app_errorhandler(MarshmallowValidationError)
def handle_marshmallow_exception(error):
    """Error handler called when a marshmallow ValidationError is raised"""

    error_message = {
        'message': 'An error occurred',
        'status': 'error',
        'errors': error.messages
    }
    return jsonify(error_message), 400


@rest_api.errorhandler(ValidationError)
@middleware_blueprint.app_errorhandler(ValidationError)
def handle_exception(error):
    """Error handler called when a ValidationError is raised"""

    return jsonify(error.error), 400