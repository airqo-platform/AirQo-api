from controllers.prediction import ml_app, cache
from flask import Flask
import logging
import os
import sys
from flask_cors import CORS
from dotenv import load_dotenv
from flask_pymongo import PyMongo
from apscheduler.schedulers.background import BackgroundScheduler
from google.cloud import storage
from os.path import join, isdir, isfile, basename
load_dotenv()

def get_saved_model():
    bucket_name = 'airqo-models-bucket'
    gcp_folder = 'gp_model'
    local_folder = 'saved_model'
    
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blobs = bucket.list_blobs(prefix=gcp_folder)
    
    if isdir(local_folder) == False:
        makedirs(local_folder)
        
    for blob in blobs:
        blob_name = blob.name 
        dst_file_name = blob_name.replace(gcp_folder, local_folder)
        if blob_name.endswith('/'):
            inner_blobs = bucket.list_blobs(prefix=blob_name)
            if len(list(inner_blobs))==0:
                pass
            elif isdir(dst_file_name) == False:
                makedirs(dst_file_name)
        else:
            blob.download_to_filename(dst_file_name)
    return {'message': 'Model successfully updated', 'success':True}, 200

sched = BackgroundScheduler(daemon=True)
sched.add_job(get_saved_model,'interval',minutes=30)
sched.start()

_logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)
cache.init_app(app)

app.config["MONGO_URI"] = os.getenv("MONGO_URI")
mongo = PyMongo(app)

app.register_blueprint(ml_app)

if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)

