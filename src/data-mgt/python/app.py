from flask import Flask
import logging
import os
from flask_cors import CORS
from flask_pymongo import PyMongo
from config import app_config
from dotenv import load_dotenv
load_dotenv()


_logger = logging.getLogger(__name__)

# db initialization
mongo = PyMongo()


def create_app(environment):
    # create a flask app instance
    app = Flask(__name__)
    app.config.from_object(app_config[environment])
    mongo.init_app(app)

    # Allow cross-brower resource sharing
    CORS(app)

    # import blueprints
    from controllers.load import load_bp

    # register blueprints
    app.register_blueprint(load_bp)

    return app


application = create_app(os.getenv("FLASK_ENV"))

if __name__ == '__main__':
    application.run(debug=True)
