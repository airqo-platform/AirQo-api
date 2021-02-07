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

    def simple_lr(self, raw_values, hourly_combined_dataset):
        slope, intercept = rg.simple_linear_regression(hourly_combined_dataset)
        calibrated_value_lr = intercept + slope * float(raw_values)
               
        return calibrated_value_lr

    def multivariate_lr(self, raw_values, temp, humidity, hourly_combined_dataset):
        slope, intercept = rg.mlr(hourly_combined_dataset)
        calibrated_value_mlr = float(raw_values) * slope[0] + float(temp) * slope[1] + float(humidity) * slope[2] + intercept      
        return calibrated_value_mlr

if __name__ == "__main__":
    calibrateInstance = Regression()
