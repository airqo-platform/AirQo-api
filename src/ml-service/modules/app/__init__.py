# This file initializes your application and
# brings together all of the various components.
# you can also connect your database in this same file.

''' flask app with mongo '''

# from app.controllers import *
from dotenv import load_dotenv
import os
import json
import datetime
from bson.objectid import ObjectId
from flask import Flask
from flask_pymongo import PyMongo

app = Flask(__name__)

# load dotenv in the base root
# refers to application_top
APP_ROOT = os.path.join(os.path.dirname(__file__), '..')
dotenv_path = os.path.join(APP_ROOT, '.env')
load_dotenv(dotenv_path)


class JSONEncoder(json.JSONEncoder):
    '''extend json-encoder class'''

    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime.datetime):
            return str(o)
        return json.JSONEncoder.default(self, o)


app.config['MONGO_URI'] = os.environ.get('DB')
mongo = PyMongo(app)
app.json_encoder = JSONEncoder
