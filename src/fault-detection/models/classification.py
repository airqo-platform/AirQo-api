import os
from pathlib import Path
import numpy as np
import pandas as pd
import pickle
from dotenv import load_dotenv
import pymongo


BASE_DIR = Path().resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)

CREDENTIALS = os.getenv('MONGO_URI')
client = pymongo.MongoClient(CREDENTIALS)

CAT_REG_MODEL = os.path.join(BASE_DIR, 'fault-detection/jobs/cat_clf_model.pkl')


class Classification():
   
    """
        The class contains functionality for computing device calibrated values .
    """
    def compute_predictions(data):      
        # Map columns from uploaded csv
        data.columns = [i.lower() for i in data.columns]
        
        #feature engineering.
        extras = data[["device_id","datetime","sensor1_pm2.5","sensor2_pm2.5"]]
        data = data[["datetime","sensor1_pm2.5","sensor2_pm2.5"]]
        data.columns = ["Datetime","Sensor1_PM2.5","Sensor2_PM2.5"]
        data["Datetime"]= pd.to_datetime(data["Datetime"])
        data = data.sort_values(by=['Datetime']).reset_index(drop=True)
        data['Datetime_day'] = data.Datetime.dt.day
        data['Datetime_month'] = data.Datetime.dt.month
        data['Datetime_year'] = data.Datetime.dt.year
        data['Datetime_hour'] = data.Datetime.dt.hour
        data["Sensor difference"] = (data["Sensor1_PM2.5"] - data["Sensor2_PM2.5"]).abs()
        data["Sensor div"] = (data["Sensor1_PM2.5"] / data["Sensor2_PM2.5"]).abs()
        data["Mean"] = data[["Sensor1_PM2.5","Sensor2_PM2.5"]].mean(axis=1)
        data["Var"] = data[["Sensor1_PM2.5","Sensor2_PM2.5"]].var(axis=1)
        data.drop("Datetime", axis=1, inplace=True)
        
        
        catboost_classifier= pickle.load(open(CAT_REG_MODEL, 'rb'))
        predictions =  catboost_classifier.predict(data)
        faults = pd.DataFrame(predictions, columns=["Offset_Fault","Out_of_bound","Data_loss_fault","High_variance_fault"])
        faults = pd.concat([faults,extras],axis=1)
        return faults.to_json(orient="records")