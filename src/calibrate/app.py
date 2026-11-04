from calibrate import calibrate_bp
from calibrate_v2 import calibrate_v2_bp
from training_api import training_bp
from flask import Flask
from upload_limits import configure_upload_limits
import logging
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

# import blue prints

_logger = logging.getLogger(__name__)

app = Flask(__name__)
configure_upload_limits(app)

# Allow cross-brower resource sharing
CORS(app)

# register blueprints
app.register_blueprint(calibrate_bp)
app.register_blueprint(calibrate_v2_bp)
app.register_blueprint(training_bp)
