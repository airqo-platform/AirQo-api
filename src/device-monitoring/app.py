from flask import Flask
import logging
import os
from flask_caching import Cache
from flask_cors import CORS
from flask_pymongo import PyMongo
from config import constants
from helpers.pre_request import PreRequest


_logger = logging.getLogger(__name__)

# db initialization
mongo = PyMongo()
cache = Cache()


def create_app(environment):
    # create a flask app instance
    app = Flask(__name__)

    app.config.from_object(constants.app_config[environment])

    mongo.init_app(app)
    cache.init_app(app)

    # Allow cross-browser resource sharing
    CORS(app)

    # import blueprints
    from controllers.check_health import health_check_bp
    from controllers.check_status import device_status_bp
    from controllers.collocation import collocation_bp

    # register blueprints
    app.register_blueprint(health_check_bp)
    app.register_blueprint(device_status_bp)
    app.register_blueprint(collocation_bp)

    return app


app = create_app(os.getenv("FLASK_ENV"))


@app.before_request
def check_tenant_param():
    return PreRequest.check_tenant()


if __name__ == '__main__':
    app.run()
