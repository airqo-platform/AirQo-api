from controllers.calibrate import calibrate_bp
from flask import Flask
import logging
import os
from flask_cors import CORS
from flask_pymongo import PyMongo
from config import environment

_logger = logging.getLogger(__name__)

mongo = PyMongo()

def create_app(environment):
    app = Flask(__name__)
    app.config.from_object(environment)
    mongo.init_app(app)
    CORS(app)
    
    # register blueprints
    app.register_blueprint(calibrate_bp)

    return app

application = create_app(environment)

if __name__ == '__main__':
    application.run(debug=True)
