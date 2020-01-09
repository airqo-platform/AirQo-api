from flask import Flask
import logging
#from api.config import get_logger

_logger = logging.getLogger(__name__)


def create_app(*, config_object) -> Flask:
    """Create a flask app instance."""

    flask_app = Flask('ml_api')
    flask_app.config.from_object(config_object)

    # import blueprints
    from api.controller import ml_app
    flask_app.register_blueprint(ml_app)
    #_logger.debug('Application instance created')

    return flask_app
   
