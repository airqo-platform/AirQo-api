''' controller and routes for users '''
import os
from flask import request, jsonify
from app import app, mongo
import logger

#import utils
# import db schema and functions accordingly

ROOT_PATH = os.environ.get('ROOT_PATH')
LOG = logger.get_root_logger(
    __name__, filename=os.path.join(ROOT_PATH, 'output.log'))


@app.route('/raw', methods=['GET', 'POST', 'DELETE', 'PATCH'])
# Utilze the functions from the utils/processed.py
# utilize the functions defined inside models/manage.py
# And then send a response accordingly
def raw_all():
    if request.method == 'GET':
        query = request.args
        data = mongo.db.raw.find_one(query)
        return jsonify(data), 200


@app.route('/raw/<id>', methods=['GET', 'POST', 'DELETE', 'PATCH'])
# Utilze the functions from the utils/processed.py
# utilize the functions defined inside models/manage.py
# And then send a response accordingly
def raw_one():
    if request.method == 'GET':
        query = request.args
        data = mongo.db.raw.find_one(query)
        return jsonify(data), 200


@app.route('/processed', methods=['GET', 'POST', 'DELETE', 'PATCH'])
# Utilze the functions from the utils/processed.py
# utilize the functions defined inside models/manage.py
# And then send a response accordingly
def processed_all():
    if request.method == 'GET':
        query = request.args
        data = mongo.db.processed.find_one(query)
        return jsonify(data), 200


@app.route('/processed/<id>', methods=['GET', 'POST', 'DELETE', 'PATCH'])
# Utilze the functions from the utils/processed.py
# utilize the functions defined inside models/manage.py
# And then send a response accordingly
def processed_one():
    if request.method == 'GET':
        query = request.args
        data = mongo.db.processed.find_one(query)
        return jsonify(data), 200
