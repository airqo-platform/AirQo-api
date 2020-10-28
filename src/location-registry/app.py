from flask import Flask
import logging
import os
from dotenv import load_dotenv
from flask_cors import CORS
from flask_pymongo import PyMongo
from controllers.controller import location_blueprint, cache
from controllers.helpers import monitor_bp
from config import app_config
load_dotenv()

_logger = logging.getLogger(__name__)
app = Flask(__name__)
app.config.from_object(app_config[os.getenv("FLASK_ENV").strip()])

CORS(app)
cache.init_app(app)
mongo = PyMongo(app)

# register blueprints
app.register_blueprint(location_blueprint)
app.register_blueprint(monitor_bp)


if __name__ == "__main__":
    app.run(debug=True)
