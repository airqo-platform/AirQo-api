from controllers.status import status_bp
from controllers.health import health_bp
from flask import Flask
import logging
import os
from flask_cors import CORS
from flask_pymongo import PyMongo
from config import constants, db_connection
from dotenv import load_dotenv
load_dotenv()
# import blueprints


_logger = logging.getLogger(__name__)

# db initialization
mongo = PyMongo()


def create_app(environment):
    # create a flask app instance
    app = Flask(__name__)
    app.config.from_object(constants.app_config[environment])
    mongo.init_app(app)

    # Allow cross-brower resource sharing
    CORS(app)

    # register blueprints
    app.register_blueprint(health_bp)
    app.register_blueprint(status_bp)

    return app


application = create_app(os.getenv("FLASK_ENV"))

if __name__ == '__main__':
    application.run(debug=True)
