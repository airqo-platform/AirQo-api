import pandas as pd
import numpy as np
import pickle
import os
from dotenv import load_dotenv
from pathlib import Path
from catboost import CatBoostClassifier
from sklearn.multiclass import OneVsRestClassifier
import pymongo


BASE_DIR = Path().resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)

CREDENTIALS = os.getenv('MONGO_URI')
client = pymongo.MongoClient(CREDENTIALS)

CAT_CLF_MODEL = os.getenv('CAT_CLF_MODEL', 'cat_clf_model.pkl')


def get_data():
    return(pd.DataFrame(list(client.fault_detection.train_data.find())))
    
def preprocess_data(data):
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
    data = data.drop(columns = ["_id","Datetime","DeviceId"], axis=1)
    return(data)
    
def split_data(data):
    y = data[["Offset_fault","Out_of_bounds_fault","Data_loss_fault","High_variance_fault"]]
    X = data.drop(columns = ["Offset_fault","Out_of_bounds_fault","Data_loss_fault","High_variance_fault"], axis=1)
    return(X,y)
    
def cat_clf(X,y):
    catboost_classifier = OneVsRestClassifier(estimator=CatBoostClassifier(n_estimators=500,max_depth=8
                          ,random_state = 42, verbose=False))
    catboost_classifier.fit(X,y)
    
    #save model to disk
    filename = CAT_CLF_MODEL
    pickle.dump(catboost_classifier, open(filename, 'wb'))
    return catboost_classifier
    
if __name__ == "__main__":
    dataset = get_data()
    processed_data = preprocess_data(dataset)
    variables,labels = split_data(processed_data)
    catboost_classifier = cat_clf(variables,labels)