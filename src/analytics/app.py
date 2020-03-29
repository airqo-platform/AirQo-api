from config import app_config
from flask import Flask
import os
import logging
from os.path import join, dirname
from dotenv import load_dotenv
from flask_pymongo import PyMongo




_logger = logging.getLogger(__name__)

mongo = PyMongo()

def create_app(*, config_object) -> Flask:
    """Create a flask app instance."""
    
    dotenv_path = join(dirname(__file__), '.env')
    load_dotenv(dotenv_path)

    flask_app = Flask(__name__)
    flask_app.config.from_object(app_config[config_object])
    flask_app.config["MONGO_URI"] =  os.getenv("MONGO_URI")
    
    #register the app with the db.
    mongo.init_app(flask_app)
    
    #import blueprints
    from controllers.monitoring_site import monitoring_site_bp
    from controllers.controller import analytics_app


    flask_app.register_blueprint(analytics_app)
    flask_app.register_blueprint(monitoring_site_bp)
    

    return flask_app
   


application = create_app(config_object=os.getenv("FLASK_ENV"))


if __name__ == '__main__':
    application.run(debug=True)
