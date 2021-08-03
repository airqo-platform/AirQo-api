import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor 
import pickle
from jobs import get_data as gd
from jobs import regression as rg

class Regression():
    """
        The class contains functionality for computing device calibrated values .
    """
    def __init__(self):
        """ initialize """
        lowcost_hourly_mean = gd.get_lowcost_data()
        bam_hourly_mean = gd.get_bam_data()
        self.hourly_combined_dataset = gd.combine_datasets(lowcost_hourly_mean, bam_hourly_mean)

    def random_forest(self, hourly_combined_dataset):
        rf_regressor, MAE, RMSE, r2_score = rg.random_forest(hourly_combined_dataset)
        print('MAE:', MAE)   
        print('RMSE:', RMSE) 
        print('R2:', r2_score)

        # save the model to disk
        filename = '../jobs/rf_reg_model.sav'
        pickle.dump(rf_regressor, open(filename, 'wb'))

        return rf_regressor
  
if __name__ == "__main__":
    calibrateInstance = Regression()
