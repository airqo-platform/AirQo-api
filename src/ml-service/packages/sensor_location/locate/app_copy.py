from config import app_config
from flask import Flask
import os
import logging
from dotenv import load_dotenv
from flask_pymongo import PyMongo
from flask_cors import CORS


mongo = PyMongo()
MONGO_URI = os.getenv("MONGO_URI")

def create_app(*, config_object) -> Flask:
    """Create a flask app instance."""
    
    flask_app = Flask(__name__)
    flask_app.config.from_object(app_config[config_object])  
    MONGO_URI = flask_app.config["MONGO_URI"]
    CORS(flask_app)
    flask_app.config['CORS_HEADERS'] = 'Content-Type'
    mongo.init_app(flask_app)

    return flask_app

app = create_app(config_object=os.getenv("FLASK_ENV"))

if __name__ == '__main__':
    appl.run(debug=True)

#app = Flask(__name__)
#app.config['MONGO_URI'] = os.getenv('MONGO_URI')
#mongo = PyMongo(app)
#CORS(app)
            
