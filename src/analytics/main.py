"""Module for creating the flask app"""

# System libraries

# Third-Party libraries
from flask import Flask, jsonify
from flask_restx import Api
from flask_cors import CORS
from decouple import config as env_config
from marshmallow import ValidationError as MarshmallowValidationError

# middlewares
from api import api_blueprint
from api.middlewares import middleware_blueprint
from api.middlewares.base_validator import ValidationError

# Config
from config import config

config_name = env_config('FLASK_ENV', 'production')
api = Api(api_blueprint, doc=False)


def initialize_errorhandlers(application):
    """Initialize error handlers"""

    application.register_blueprint(middleware_blueprint)
    application.register_blueprint(api_blueprint)


def create_app(config=config[config_name]):
    """creates a flask app object from a config object"""

    app = Flask(__name__)
    CORS(app)
    app.config.from_object(config)

    # Initialize error handlers
    initialize_errorhandlers(app)

    # import views
    import api.views


    return app


@api.errorhandler(MarshmallowValidationError)
@middleware_blueprint.app_errorhandler(MarshmallowValidationError)
def handle_marshmallow_exception(error):
    """Error handler called when a marshmallow ValidationError is raised"""

    error_message = {
        'message': 'An error occurred',
        'status': 'error',
        'errors': error.messages
    }
    return jsonify(error_message), 400


@api.errorhandler(ValidationError)
@middleware_blueprint.app_errorhandler(ValidationError)
def handle_exception(error):
    """Error handler called when a ValidationError is raised"""

    return jsonify(error.error), 400