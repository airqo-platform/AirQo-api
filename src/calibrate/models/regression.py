import numpy as np
from jobs import get_data as gd
from jobs import regression as rg
import pandas as pd


class Regression():
    """
        The class contains functionality for computing device calibrated values .
    """
    def __init__(self):
        """ initialize """
        lowcost_hourly_mean = gd.get_lowcost_data()
        bam_hourly_mean = gd.get_bam_data()
        self.hourly_combined_dataset = gd.combine_datasets(lowcost_hourly_mean, bam_hourly_mean)


    def random_forest(self, datetime, pm2_5, pm10, temperature,humidity,hourly_combined_dataset):
        rf_reg, MAE3, RMSE3, r2_score3 = rg.random_forest(hourly_combined_dataset)

        datetime = pd.to_datetime(datetime)
        # extract month feature
        month = datetime.month
        # extract hour feature
        hour = datetime.hour

        input_variables = pd.DataFrame([[pm2_5, pm10, temperature, humidity, month, hour]],
                                       columns=['pm2_5','temperature','humidity','pm10','month','hour'],
                                       dtype='float',
                                       index=['input'])

        calibrated_value_rf =  rf_reg.predict(input_variables)[0]
        print('MAE3:', MAE3)   
        print('RMSE3:', RMSE3) 
        print('R2_3:', r2_score3) 
        return calibrated_value_rf

if __name__ == "__main__":
    calibrateInstance = Regression()
