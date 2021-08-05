import numpy as np
import pandas as pd
import pickle
# from jobs import get_data as gd
from jobs import regression as rg

class Regression():
    """
        The class contains functionality for computing device calibrated values .
    """
    # def __init__(self):
    #     """ initialize """
    #     lowcost_hourly_mean = gd.get_lowcost_data()
    #     bam_hourly_mean = gd.get_bam_data()
    #     self.hourly_combined_dataset = gd.combine_datasets(lowcost_hourly_mean, bam_hourly_mean)

    # def random_forest(self, hourly_combined_dataset, pm2_5,s2_pm2_5,pm10,s2_pm10,temperature,humidity, datetime):
    #     rf_regressor = rg.random_forest(hourly_combined_dataset)

    def compute_calibrated_val(self,pm2_5,s2_pm2_5,pm10,s2_pm10,temperature,humidity, datetime):
        rf_regressor = pickle.load(open('jobs/rf_reg_model.sav', 'rb'))
        
        # features from datetime and PM
        datetime = pd.to_datetime(datetime)
        hour = datetime.hour
        input_variables = pd.DataFrame([[pm2_5,s2_pm2_5,pm10,s2_pm10,temperature,humidity,hour]],
                                    columns=['pm2_5','s2_pm2_5','pm10','s2_pm10','temperature','humidity','hour'],
                                    dtype='float',
                                    index=['input'])
        input_variables["avg_pm2_5"] = input_variables[['pm2_5','s2_pm2_5']].mean(axis=1).round(2)
        input_variables["avg_pm10"] =  input_variables[['pm10','s2_pm10']].mean(axis=1).round(2)
        input_variables["error_pm10"]=np.abs(input_variables["pm10"]-input_variables["s2_pm10"])
        input_variables["error_pm2_5"]=np.abs(input_variables["pm2_5"]-input_variables["s2_pm2_5"])
        input_variables["pm2_5_pm10"]=input_variables["avg_pm2_5"]-input_variables["avg_pm10"]
        input_variables["pm2_5_pm10_mod"]=input_variables["pm2_5_pm10"]/input_variables["avg_pm10"]
        input_variables = input_variables.drop(['pm2_5','s2_pm2_5','pm10','s2_pm10'], axis=1)
        
        #reorganise columns
        input_variables = input_variables[['avg_pm2_5','avg_pm10','temperature','humidity','hour','error_pm2_5','error_pm10','pm2_5_pm10', 'pm2_5_pm10_mod']]

        calibrated_value_rf =  rf_regressor.predict(input_variables)[0]          
        
        return calibrated_value_rf
               
    
if __name__ == "__main__":
    calibrateInstance = Regression()
