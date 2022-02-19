import pandas as pd
import numpy as np
import datetime
from sklearn.ensemble import RandomForestRegressor 
from sklearn.linear_model import Lasso
import pickle
import gcsfs
import joblib
import os
from dotenv import load_dotenv
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path)

class Regression():
    def random_forest(combined_ext_data):
        X= combined_ext_data[['Average_PM2.5','Average_PM10','temperature','humidity','hour','error_pm2_5','error_pm10','pm2_5_pm10', 'pm2_5_pm10_mod']].values
        y = combined_ext_data['ref_data'].values    

        rf_regressor = RandomForestRegressor(random_state=42, max_features='sqrt', n_estimators= 1000, max_depth=50, bootstrap = True)
        # Fitting the model 
        rf_regressor = rf_regressor.fit(X, y) 
       
        return rf_regressor

    def lasso_reg(combined_ext_data):
        X= combined_ext_data[['Average_PM2.5','Average_PM10','temperature','humidity','hour','error_pm2_5','error_pm10','pm2_5_pm10', 'pm2_5_pm10_mod']].values
        y = combined_ext_data['ref_data'].values   

        # Fitting the model 
        lasso_regressor = Lasso(random_state=0).fit(X, y)
        return lasso_regressor

if __name__ == "__main__":
    calibrateInstance = Regression()
