import numpy as np
from jobs.regression import simple_linear_regression, mlr


class regression_class():
    """
        The class contains functionality for computing device calibrated values .
    """
    def __init__(self):
        """ initialize """

   def simple_lr(self):
       regressor_lr = simple_linear_regression(hourly_combined_dataset)
       
        return regressor_lr

    def multivariate_lr(self):
       regressor_mlr = mlr(hourly_combined_dataset)
       
        return regressor_mlr
   

if __name__ == "__main__":
    calibrateInstance = Calibrate()
