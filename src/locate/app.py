from flask import Flask
import logging, os, sys
import config
from flask_cors import CORS
from flask_pymongo import PyMongo
from controllers.locate import locate_blueprint, cache
from controllers.helpers import monitor_bp


_logger = logging.getLogger(__name__)

# db initialization
mongo = PyMongo()


def create_app(environment):
    # create a flask app instance
    app = Flask(__name__)
    app.config.from_object(config.app_config[environment])
    mongo.init_app(app)
    cache.init_app(app)

    # Allow cross-brower resource sharing
    CORS(app)

    # register blueprints
    app.register_blueprint(locate_blueprint)
    app.register_blueprint(monitor_bp)
    

    return app


application = create_app(config.environment)

if __name__ == '__main__':
    application.run()