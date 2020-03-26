# This is where the routes for the predictions are defined.

import os
from flask import request, jsonify, Flask
from flask_cors import CORS
from app import app, mongo
import logger


ROOT_PATH = os.environ.get('ROOT_PATH')
LOG = logger.get_root_logger(
    __name__, filename=os.path.join(ROOT_PATH, 'output.log')
)


@app.route('/predict', methods=['GET', 'POST'])
def forecast():
    return 'hello predict'

@app.route('/route 2', methods=['GET', 'POST'])
def forecast():
    return 'hello route 2'

# define the endpoints for getting forecast,
