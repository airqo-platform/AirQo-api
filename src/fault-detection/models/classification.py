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

def calibrate(list_of_dict):    
        df = pd.DataFrame(list_of_dict)

        #     if (not device_id or not s1_pm2_5 or not s2_pm2_5):
        #         return jsonify({"message": "Please specify the device_id, datetime, sensor1 pm2.5, sensor2 pm2.5, sensor1 pm10, sensor1 pm10, temperature and humidity values in the body. Refer to the API documentation for details.", "success": False}), 400
        #     calibrated_pm2_5, calibrated_pm10 = model.compute_calibrated_val(s1_pm2_5,s2_pm2_5)           
        #     response.append({'device_id': device_id, 'calibrated_PM2.5': calibrated_pm2_5, 'calibrated_PM10': calibrated_pm10 })
        # return jsonify(response), 200

class Classification():

    def predict_faults(self,input_variables):
        # features from datetime and PM

        input_variables = pd.DataFrame(input_variables)
        output_variables = pd.DataFrame()
        map_columns = {
            "time":'Datetime',
            "device_id":"Device_ID",
            "sensor1_pm2.5":'Sensor1_PM2.5',
            "sensor2_pm2.5":'Sensor2_PM2.5'
            
        }
        input_variables.rename(columns=map_columns, inplace=True)

        # input_variables.sort_values(by=['Datetime']).reset_index(drop=True)
        # input_variables['Datetime'] = pd.to_datetime(dataset.Datetime)
        # input_variables['Datetime_day'] = dataset.Datetime.dt.day
        # input_variables['Datetime_month'] = dataset.Datetime.dt.month
        # input_variables['Datetime_hour'] = dataset.Datetime.dt.hour

        print(input_variables)
        X= input_variables[['Sensor1_PM2.5','Sensor2_PM2.5']].values
        # y = input_variables[['Offset_fault','Out_of_bounds_fault','Data_loss_fault','High_variance_fault']].values  

        #load model from disk
        scaler = pickle.load(open(SCALER, 'rb'))
        # load model
        savedModel=load_model(LSTM_MODEL)
        # # load model from GCP 
        # rf_regressor = self.get_model('airqo-250220','airqo_prediction_bucket', 'PM2.5_calibrate_model.pkl')
        X =  scaler.transform(X)
        print(X)
        output =  savedModel.predict(X)
        output_variables["Device_ID"] = input_variables["Device_ID"]
        output_variables[['Offset_fault','Out_of_bounds_fault','Data_loss_fault','High_variance_fault']] = output
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
