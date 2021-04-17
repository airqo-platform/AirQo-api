import numpy as np
from jobs import regression as rg
import pandas as pd


class Regression():
    """
        The class contains functionality for computing device calibrated values .
    """
    def __init__(self):
        """ initialize """
        lowcost_hourly_mean = rg.get_lowcost_data()
        bam_hourly_mean = rg.get_bam_data()
        self.hourly_combined_dataset = rg.combine_datasets(lowcost_hourly_mean, bam_hourly_mean)

    def simple_lr(self, raw_value, hourly_combined_dataset):
        slope, intercept, MAE, RMSE, r2_score = rg.simple_linear_regression(hourly_combined_dataset)
        calibrated_value_lr = intercept + slope * float(raw_value)
        print('MAE:', MAE)   
        print('RMSE:', RMSE)   
        print('R2:', r2_score)  
        return calibrated_value_lr

    def multivariate_lr(self, raw_value, temp, humidity, hourly_combined_dataset):
        slope, intercept, MAE2, RMSE2, r2_score2 = rg.mlr(hourly_combined_dataset)
        calibrated_value_mlr = float(raw_values) * slope[0] + float(temp) * slope[1] + float(humidity) * slope[2] + intercept    
        print('MAE2:', MAE2)   
        print('RMSE2:', RMSE2) 
        print('R2_2:', r2_score2) 
        return calibrated_value_mlr

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
