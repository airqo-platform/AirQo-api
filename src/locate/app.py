from flask import Flask
import logging
import os, sys
from flask_cors import CORS
from flask_pymongo import PyMongo
from controllers.locate import locate_blueprint, cache
from dotenv import load_dotenv

load_dotenv()
_logger = logging.getLogger(__name__)
app = Flask(__name__)
CORS(app)
cache.init_app(app)
app.config["MONGO_URI"] = os.getenv("MONGO_URI")
mongo = PyMongo(app)
app.register_blueprint(locate_blueprint)

if __name__ == "__main__":
    app.run(debug=True)