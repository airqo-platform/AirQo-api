import pandas as pd
import gcsfs
import joblib
from lightgbm import LGBMRegressor, early_stopping
from sklearn.metrics import mean_squared_error


class ForecastTrainingUtils:
    @staticmethod
    def preprocess_data(hourly_df, daily_df):
        dfs = [hourly_df, daily_df]
        final_dfs = []

        for df in dfs:
            df['created_at'] = pd.to_datetime(df['created_at'])
            df['pm2_5'] = df.groupby('device_number')['pm2_5'].transform(
                lambda x: x.interpolate(method='linear', limit_direction='both'))
            forecast_data = forecast_data.dropna(subset=['pm2_5'])

            if df == daily_df:
                forecast_data['device_number'] = forecast_data['device_number'].astype(str)
                forecast_data = forecast_data.groupby(
                    ['device_number']).resample('D', on='created_at').mean(numeric_only=True)
                forecast_data = forecast_data.reset_index()
                forecast_data['pm2_5'] = forecast_data.groupby('device_number')['pm2_5'].transform(
                    lambda x: x.interpolate(method='linear',
                                            limit_direction='both'))  # interpolate again after resampling
                forecast_data['device_number'] = forecast_data['device_number'].astype(int)

            final_dfs.append(forecast_data)

        return final_dfs[0], final_dfs[1]

    @staticmethod
    def train_model(daily_train, hourly_train):
        """
        Perform model training
        """

        models = {}
        train_data = {'daily': daily_train, 'hourly': hourly_train}

        for forecast_type in train_data.keys():

            print(f'{forecast_type} feature selection started.....')
            train = train_data[forecast_type]
            train = train.sort_values(by=['device_number', 'created_at'])
            features = [c for c in train.columns if c not in ["created_at", "pm2_5"]]
            print(features)
            target_col = "pm2_5"

            # Define training data for each forecast type

            training_months = {'daily': 9, 'hourly': 4}

            train_data, test_data = pd.DataFrame(), pd.DataFrame()

            for device_number in train['device_number'].unique():
                device_df = train[train['device_number'] == device_number]
                device_df = device_df.sort_values(by='created_at')
                months = device_df['created_at'].dt.month.unique()
                train_months = months[:training_months[forecast_type]]
                test_months = months[training_months[forecast_type]:]
                train_df = device_df[device_df['created_at'].dt.month.isin(train_months)]
                test_df = device_df[device_df['created_at'].dt.month.isin(test_months)]
                train_data = pd.concat([train_data, train_df])
                test_data = pd.concat([test_data, test_df])

            train_data['device_number'] = train_data['device_number'].astype(int)
            test_data['device_number'] = test_data['device_number'].astype(int)
            train_data.drop(columns=['created_at'], axis=1, inplace=True)
            test_data.drop(columns=['created_at'], axis=1, inplace=True)

            train_target, test_target = train_data[target_col], test_data[target_col]
            with mlflow.start_run():
                print("Model training started.....")
                n_estimators = 5000
                learning_rate = 0.05
                colsample_bytree = 0.4
                reg_alpha = 0
                reg_lambda = 1
                max_depth = 1
                random_state = 1

                clf = LGBMRegressor(
                    n_estimators=n_estimators,
                    learning_rate=learning_rate,
                    colsample_bytree=colsample_bytree,
                    reg_alpha=reg_alpha,
                    reg_lambda=reg_lambda,
                    max_depth=max_depth,
                    random_state=random_state)

                clf.fit(train_data[features], train_target, eval_set=[(test_data[features], test_target)],
                        callbacks=[early_stopping(stopping_rounds=150)], verbose=50,
                        eval_metric='rmse')
                print('Model training completed.....')

                # Log parameters
                mlflow.log_param("n_estimators", n_estimators)
                mlflow.log_param("learning_rate", learning_rate)
                mlflow.log_param("colsample_bytree", colsample_bytree)
                mlflow.log_param("reg_alpha", reg_alpha)
                mlflow.log_param("reg_lamba", reg_lambda)
                mlflow.log_param("max_depth", max_depth)
                mlflow.log_param("random_state", random_state)

                # Log model
                model_forecast_type = f"{forecast_type}_forecast_model"

                mlflow.sklearn.log_model(
                    sk_model=clf,
                    artifact_path=model_forecast_type,
                    registered_model_name=f"LGBM_{model_forecast_type}_{environment}"
                )

                # model validation
                print(f"Being {forecast_type} model validation.....")

                val_preds = clf.predict(test_data[features])
                rmse_val = mean_squared_error(test_data[target_col], val_preds) ** 0.5

                print(f"{forecast_type} model validation completed.....")
                print(f'Validation RMSE for {forecast_type} is {rmse_val}')

                # Log metrics
                mlflow.log_metric(f"{forecast_type}_VAL_RMSE", rmse_val)

                best_iter = clf.best_iteration_
                clf = LGBMRegressor(n_estimators=best_iter, learning_rate=0.05, colsample_bytree=0.4, reg_alpha=2,
                                    reg_lambda=1,
                                    max_depth=-1, random_state=1)
                train['device_number'] = train['device_number'].astype(int)
                clf.fit(train[features], train[target_col])

                models[forecast_type] = clf

        return models['daily'], models['hourly']

    @staticmethod
    def feature_eng_df(df_tmp, target_column, forecast_type):
        def get_lag_features(df_tmp, TARGET_COL, forecast_type):
            df_tmp = df_tmp.sort_values(by=['device_number', 'created_at'])

            # Assign the correct lag and rolling features based on forecast type
            lag_features = {
                'daily': {'shifts': [1, 2], 'rolls': [3, 7, 14, 30], 'functions': ['mean', 'std', 'max', 'min']},
                'hourly': {'shifts': [1, 2], 'rolls': [6, 12, 24, 48],
                           'functions': ['mean', 'std', 'max', 'min', 'skew']}
            }

            shifts = lag_features[forecast_type]['shifts']
            for s in shifts:
                df_tmp[f'pm2_5_last_{s}_{forecast_type}'] = df_tmp.groupby(['device_number'])[TARGET_COL].shift(s)

            # lag features
            shifts = lag_features[forecast_type]['rolls']
            functions = lag_features[forecast_type]['functions']
            for s in shifts:
                for f in functions:
                    df_tmp[f'pm2_5_{f}_{s}_{forecast_type}'] = df_tmp.groupby(['device_number'])[TARGET_COL].shift(
                        1).rolling(s).agg(f)

            return df_tmp

        def get_other_features(df_tmp, forecast_type):
            attributes = ['year', 'month', 'day', 'dayofweek']

            if forecast_type == 'hourly':
                attributes.extend(['hour', 'minute'])

            for a in attributes:
                df_tmp[a] = df_tmp['created_at'].dt.__getattribute__(a)

            df_tmp['week'] = df_tmp['created_at'].dt.isocalendar().week.astype(int)

            return df_tmp

        df_tmp = get_lag_features(df_tmp, target_column, forecast_type)
        df_tmp = get_other_features(df_tmp, forecast_type)

        return df_tmp

    @staticmethod
    def upload_trained_model_to_gcs(trained_model_daily, trained_model_hourly, project_name, bucket_name,
                                    source_blob_name_daily, source_blob_name_hourly):
        fs = gcsfs.GCSFileSystem(project=project_name)

        trained_models = {'daily': trained_model_daily, 'hourly': trained_model_hourly}
        source_blob_names = {'daily': source_blob_name_daily, 'hourly': source_blob_name_hourly}

        for forecast_type in trained_models.keys():
            # backup previous model
            try:
                fs.rename(f'{bucket_name}/{source_blob_names[forecast_type]}',
                          f'{bucket_name}/{datetime.now()}-{source_blob_names[forecast_type]}')
                print(f"Bucket: previous {forecast_type} model is backed up")
            except:
                print(f"Bucket: No {forecast_type} file to updated")

            # store new model
            with fs.open(bucket_name + '/' + source_blob_names[forecast_type], 'wb') as handle:
                joblib.dump(trained_models[forecast_type], handle)
