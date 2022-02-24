from copyreg import pickle
import gcsfs
import os
import joblib
import mlflow
from datetime import datetime
import mlflow.sklearn
from config import configuration,environment

class Mlflow:
    def __init__(self) -> None:
        self.uri = configuration.MLFLOW_TRACKING_URI

    def set_uri (self):
        mlflow.set_tracking_uri(self.uri)
        print(f"mlflow server: {mlflow.get_tracking_uri()}")

    @staticmethod
    def set_experiment(name: str):
        mlflow.set_experiment(f'{name}_{environment}')

    @staticmethod
    def log_parameters(**params) -> None:
        for key, value in params.items():
             mlflow.log_param(key, value)

    @staticmethod
    def log_model(model: any, path: str, registered_model_name: str):
        mlflow.sklearn.log_model(
            sk_model = model, 
            artifact_path=path,
            registered_model_name = registered_model_name
            )

    def start_run(name: str) -> None:
        mlflow.start_run(run_name=name)

    def end_run(name: str) -> None:
        mlflow.end_run(name)

class Dvc:
    pass

class ModelMonitor:
    pass

class Util:

    def upload_trained_model_to_gcs(trained_model,project_name,bucket_name,source_blob_name):

        # upload model only if environment is not development
        if environment is not "development":
            fs = gcsfs.GCSFileSystem(project=project_name)

            # backup previous model 
            try:
                fs.rename(f'{bucket_name}/{source_blob_name}', f'{bucket_name}/{datetime.now()}-{source_blob_name}')
                print("Bucket: previous model is backed up")
            except:
                print("Bucket: No file to updated")

            # store new model
            with fs.open(bucket_name + '/' + source_blob_name, 'wb') as handle:
                job = joblib.dump(trained_model,handle)