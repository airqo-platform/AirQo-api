from flask import Flask
import logging
import os
from dotenv import load_dotenv
from flask_cors import CORS
from flask_pymongo import PyMongo
from controllers.controller import location_blueprint, cache
load_dotenv()

_logger = logging.getLogger(__name__)
app = Flask(__name__)
CORS(app)
cache.init_app(app)
app.config["MONGO_URI"] = os.getenv("MONGO_URI")
mongo = PyMongo(app)
app.register_blueprint(location_blueprint)


if __name__ == "__main__":
    app.run(debug=True)
