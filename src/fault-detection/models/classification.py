import os
from pathlib import Path
import numpy as np
import pandas as pd
import pickle
import joblib
from dotenv import load_dotenv
from keras.models import load_model


# BASE_DIR = Path(__file__).resolve().parent
# dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv()

LSTM_MODEL = os.getenv('LSTM_MODEL','jobs/lstm_model.h5')
SCALER = os.getenv('SCALER','jobs/scaler.pkl')



class Classification():

    def predict_faults(self,input_variables):
        # features from datetime and PM

        input_variables = pd.DataFrame(input_variables)
        output_variables = pd.DataFrame()
        map_columns = {
            "datetime":'Datetime',
            "device_id":"Device_id",
            "sensor1_pm2.5":'Sensor1_PM2.5',
            "sensor2_pm2.5":'Sensor2_PM2.5'
            
        }
        input_variables.rename(columns=map_columns, inplace=True)

        print(input_variables)
        X= input_variables[['Sensor1_PM2.5','Sensor2_PM2.5']].values

        #load model from disk
        scaler = pickle.load(open(SCALER, 'rb'))
        # load model
        savedModel=load_model(LSTM_MODEL)
        X =  scaler.transform(X)

        output =  savedModel.predict(X)
        output_variables["Datetime"] = input_variables["Datetime"]
        output_variables["Device_id"] = input_variables["Device_id"]
        output_variables[['Offset_fault','Out_of_bounds_fault','Data_loss_fault','High_variance_fault']] = np.where(output>0.5,1,0)
        print(output_variables)
        return output_variables
               
if __name__ == "__main__":
    variables = {
        "time":9494,
        'Sensor1_PM2.5':2000,
        'Sensor2_PM2.5':2000
    }
    predictor = Classification()
    print(predictor.predict_faults(variables))
