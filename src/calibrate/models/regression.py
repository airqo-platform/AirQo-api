import numpy as np
from jobs import regression as rg


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

    def random_forest(self, hourly_combined_dataset, raw_value, temp, humidity, lowcost_pm10, month, hour):
        slope, intercept, MAE2, RMSE2, r2_score2 = rg.mlr(hourly_combined_dataset)
        calibrated_value_mlr = float(raw_values) * slope[0] + float(temp) * slope[1] + float(humidity) * slope[2] + intercept    
        print('MAE2:', MAE2)   
        print('RMSE2:', RMSE2) 
        print('R2_2:', r2_score2) 
        return calibrated_value_mlr

if __name__ == "__main__":
    calibrateInstance = Regression()
