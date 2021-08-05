from sklearn.ensemble import RandomForestRegressor 


def random_forest(hourly_combined_dataset):
    X= hourly_combined_dataset[['avg_pm2_5','avg_pm10','temperature','humidity','hour','error_pm2_5','error_pm10','pm2_5_pm10', 'pm2_5_pm10_mod']].values
    y = hourly_combined_dataset['bam_pm'].values    

    rf_regressor = RandomForestRegressor(random_state=42, max_features='sqrt', n_estimators= 1000, max_depth=50, bootstrap = True)
    # Fitting the model 
    rf_regressor = rf_regressor.fit(X, y) 
    
    return rf_regressor


    