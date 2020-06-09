from flask import Flask
import logging
import os
from flask_cors import CORS
from flask_pymongo import PyMongo

# import blue prints
from controllers.helpers import monitor_bp
from controllers.device_status import device_status_bp

_logger = logging.getLogger(__name__)

app = Flask(__name__)

# Allow cross-brower resource sharing
CORS(app)

app.config["MONGO_URI"] = os.getenv("MONGO_URI")
mongo = PyMongo(app)

# register blueprints
app.register_blueprint(monitor_bp)
app.register_blueprint(device_status_bp)

if __name__ == "__main__":
    app.run(debug=True)
