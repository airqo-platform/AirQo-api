from config import app_config
from flask import Flask
import os
import logging
from os.path import join, dirname
from dotenv import load_dotenv
from flask_pymongo import PyMongo
from flask_cors import CORS



_logger = logging.getLogger(__name__)

mongo = PyMongo()
MONGO_URI = ''

def create_app(*, config_object) -> Flask:
    """Create a flask app instance."""
    
    flask_app = Flask(__name__)
    flask_app.config.from_object(app_config[config_object]) 
    #flask_app.config["MONGO_URI"] =  
    MONGO_URI = flask_app.config["MONGO_URI"]
    #allow cross domain requests
    CORS(flask_app)
    flask_app.config['CORS_HEADERS'] = 'Content-Type'
    #register the app with the db.
    mongo.init_app(flask_app)
    
    #import blueprints
    from controllers.monitoring_site import monitoring_site_bp
    from controllers.helpers import analytics_app
    from controllers.dashboard import dashboard_bp
    from controllers.graph import graph_bp  
    from controllers.report import report_bp 


    flask_app.register_blueprint(analytics_app)
    flask_app.register_blueprint(monitoring_site_bp)
    flask_app.register_blueprint(dashboard_bp)
    flask_app.register_blueprint(graph_bp)
    flask_app.register_blueprint(report_bp)


    return flask_app
   


application = create_app(config_object=os.getenv("FLASK_ENV"))


if __name__ == '__main__':
    application.run(debug=True)
