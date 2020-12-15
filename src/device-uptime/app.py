import argparse
from config import db_connection
from controllers import uptime
from flask import Flask
import logging
import os
from flask_cors import CORS
from flask_pymongo import PyMongo
from config import constants
from dotenv import load_dotenv
load_dotenv()


# _logger = logging.getLogger(__name__)

# # db initialization
# mongo = PyMongo()


# def create_app(environment):
#     # create a flask app instance
#     app = Flask(__name__)
#     app.config.from_object(constants.app_config[environment])
#     mongo.init_app(app)

#     # Allow cross-brower resource sharing
#     CORS(app)

#     # import blueprints
#     from controllers.health import health_bp
#     from controllers.uptime import uptime_bp

#     # register blueprints
#     app.register_blueprint(health_bp)
#     app.register_blueprint(uptime_bp)

#     return app


# application = create_app(os.getenv("FLASK_ENV"))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='save the uptime.')
    parser.add_argument('--tenant',
                        default="airqo",
                        help='the tenant key is the organisation name')
    args = parser.parse_args()
    uptime.save_device_uptime(args.tenant)
