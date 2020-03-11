from config import DevelopmentConfig, ProductionConfig
from flask import Flask
import logging

_logger = logging.getLogger(__name__)


def create_app(*, config_object) -> Flask:
    """Create a flask app instance."""

    flask_app = Flask('analytics_app')
    flask_app.config.from_object(config_object)

    #import blueprints
    from controllers.controller import analytics_app
    flask_app.register_blueprint(analytics_app)
   

    return flask_app
   


application = create_app(config_object=ProductionConfig)


if __name__ == '__main__':
    application.run(debug=True)
