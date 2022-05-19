from dotenv import load_dotenv, find_dotenv, set_key
import os
import pandas as pd
import numpy as np
from pymongo import MongoClient
from catboost import CatBoostClassifier
import pickle
from sklearn.multiclass import OneVsRestClassifier
from pathlib import Path



BASE_DIR = Path(__file__).resolve().parent

load_dotenv(find_dotenv())
set_key(find_dotenv(), "CATBOOST_MODEL", str(BASE_DIR) + "/catboost_model.pkl")

CATBOOST_MODEL = os.getenv('CATBOOST_MODEL','jobs/catboost_model.pkl')


MONGO_URI = os.environ.get("MONGO_URI")
client = MongoClient(MONGO_URI)
train_data = client.fault_detection.train_data
train_df = pd.DataFrame(list(train_data.find()))

def create_model(df):
    df.sort_values(by=['Datetime']).reset_index(drop=True)
    df["Datetime"] = pd.to_datetime(df.Datetime)
    df['Datetime_day'] = df.Datetime.dt.day
    df['Datetime_month'] = df.Datetime.dt.month
    df['Datetime_hour'] = df.Datetime.dt.hour

    df["Sensor difference"] = (df["Sensor1_PM2.5"] - df["Sensor2_PM2.5"]).abs()
    df["Sensor div"] = (df["Sensor1_PM2.5"] / df["Sensor2_PM2.5"]).abs()
    df["Mean"] = df[["Sensor1_PM2.5","Sensor2_PM2.5"]].mean(axis=1)
    df["Var"] = df[["Sensor1_PM2.5","Sensor2_PM2.5"]].var(axis=1)

    features = ['Sensor1_PM2.5', 'Sensor2_PM2.5','Datetime_day', 'Datetime_month','Datetime_hour', 'Sensor difference', 'Sensor div', 'Mean', 'Var']
    targets = ["Offset_fault","Out_of_bounds_fault","Data_loss_fault","High_variance_fault"]

    X = df[features]
    y = df[targets]

    ovr = OneVsRestClassifier(estimator=CatBoostClassifier(n_estimators=50,max_depth=3
                            ,random_state = 42, verbose=False))
    ovr.fit(X,y)
    pickle.dump(ovr, open(str(CATBOOST_MODEL), 'wb'))
    
    return ovr


if __name__ == "__main__":
    cat_classifier = create_model(train_df)
