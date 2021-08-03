import pandas as pd
import numpy as np
import os
import datetime
from sklearn.ensemble import RandomForestRegressor 
from sklearn.model_selection import train_test_split
from sklearn import metrics


def random_forest(hourly_combined_dataset):
    X_rf_muk = hourly_combined_dataset[['avg_pm2_5','avg_pm10','temperature','humidity','hour','error_pm2_5','error_pm10','pm2_5_pm10', 'pm2_5_pm10_mod']].values
    y_rf_muk = hourly_combined_dataset['bam_pm'].values    

    X_train_rf_muk, X_test_rf_muk, y_train_rf_muk, y_test_rf_muk = train_test_split(X_rf_muk, y_rf_muk, test_size=0.2, random_state=0)
    rf_regressor = RandomForestRegressor(random_state=42, max_features='sqrt', n_estimators= 1000, max_depth=50, bootstrap = True)
    # Fitting the model 
    rf_reg = rf_regressor.fit(X_train_rf_muk, y_train_rf_muk) 
    '''RandomForestRegressor(bootstrap=True, ccp_alpha=0.0, criterion='mse', 
                    max_depth=None, max_features='auto', max_leaf_nodes=None, 
                    max_samples=None, min_impurity_decrease=0.0, 
                    min_impurity_split=None, min_samples_leaf=1, 
                    min_samples_split=2, min_weight_fraction_leaf=0.0, 
                    n_estimators=100, n_jobs=None, oob_score=False, 
                    random_state=None, verbose=0, warm_start=False)'''

    y_pred_rf_muk = rf_regressor.predict(X_test_rf_muk)
    MAE = metrics.mean_absolute_error(y_test_rf_muk, y_pred_rf_muk)   
    RMSE =  np.sqrt(metrics.mean_squared_error(y_test_rf_muk, y_pred_rf_muk))
    r2_score = metrics.r2_score(y_test_rf_muk, y_pred_rf_muk)

    return rf_regressor, MAE, RMSE, r2_score


    