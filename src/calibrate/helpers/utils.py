from copyreg import pickle
import os
import mlflow
import mlflow.sklearn
from config import configuration,environment
class Mlflow:
    def __init__(self) -> None:
        self.uri = configuration.MLFLOW_TRACKING_URL

    def set_uri (self):
        mlflow.set_tracking_uri(self.uri)
    
    @staticmethod
    def set_experiment(name: str):
        mlflow.set_experiment(f'{name}_{environment}')
    
    @staticmethod
    def log_parameters(**params) -> None:
        for key, value in params.items():
             mlflow.log_param(key, value)

    @staticmethod
    def log_model(model: any, registered_model_name: str):
        mlflow.sklearn.log_model(
            sk_model = model, 
            registered_model_name = registered_model_name,
            )

    def start_run(name: str) -> None:
        mlflow.start_run(run_id=name)
    
    def end_run(name: str) -> None:
        mlflow.end_run(name)

class Dvc:
    pass

class ModelMonitor:
    pass