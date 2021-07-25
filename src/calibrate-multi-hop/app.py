import os

from flask import Flask
from flask_cors import CORS
from flask_pymongo import PyMongo
from config.config import app_config
from controllers.calibrate import calibrate_bp


mongo = PyMongo()


def create_app(environment):
    app = Flask(__name__)
    app.config.from_object(app_config[environment])

    mongo.init_app(app)
    CORS(app)

    # register blueprints
    app.register_blueprint(calibrate_bp)

    return app


app = create_app(os.getenv("FLASK_ENV"))


if __name__ == '__main__':
    app.run(debug=True)
