from datetime import datetime

import gcsfs
import joblib
import mlflow
import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor, early_stopping
from sklearn.metrics import mean_squared_error

from .config import configuration


def bytes_to_model(model_bytes):
    return joblib.load(model_bytes)
class ForecastUtils:

    @staticmethod
    def preprocess_hourly_training_data(data):  # separate code for hourly data

        print("preprocess_hourly_training_data started.....")
        data["created_at"] = pd.to_datetime(data["created_at"])
        data["pm2_5"] = data.groupby("device_number")["pm2_5"].transform(
            lambda x: x.interpolate(method="linear", limit_direction="both")
        )
        hourly_df = data.dropna(subset=["pm2_5"])
        return hourly_df
    
    @staticmethod
    def preprocess_daily_training_data(data):  # separate code for monthly data
        print("preprocess_monthly_training_data started.....")
        data["created_at"] = pd.to_datetime(data["created_at"])
        data["pm2_5"] = data.groupby("device_number")["pm2_5"].transform(
            lambda x: x.interpolate(method="linear", limit_direction="both")
        )
        daily_df = data.dropna(subset=["pm2_5"])
        daily_df["device_number"] = daily_df["device_number"].astype(str)
        daily_df = (
            daily_df.groupby(["device_number"])
            .resample("D", on="created_at")
            .mean(numeric_only=True)
        )
        daily_df = daily_df.reset_index()
        daily_df["pm2_5"] = daily_df.groupby("device_number")["pm2_5"].transform(
            lambda x: x.interpolate(method="linear", limit_direction="both")
        )
        daily_df["device_number"] = daily_df["device_number"].astype(int)
        return daily_df


    @staticmethod
    def feature_eng_daily_training_data(
        data, target_column
    ):

        def get_lag_features(df, target_col):
            df = df.sort_values(by=["device_number", "created_at"])
        
            shifts = [1, 2]
            for s in shifts:
                df[f"pm2_5_last_{s}_day"] = df.groupby(["device_number"])[
                    target_col
                ].shift(s)
        
            shifts = [3, 7, 14, 30]
            functions = ["mean", "std", "max", "min"]
            for s in shifts:
                for f in functions:
                    df[f"pm2_5_{f}_{s}_day"] = (
                        df.groupby(["device_number"])[target_col].shift(1).rolling(s).agg(f)
                    )
        
            return df
        
        def get_other_features(df_tmp):
            attributes = ["year", "month", "day", "dayofweek"]
            for a in attributes:
                df_tmp[a] = df_tmp["created_at"].dt.__getattribute__(a)
            df_tmp["week"] = df_tmp["created_at"].dt.isocalendar().week.astype(int)
            return df_tmp

        data['created_at'] = pd.to_datetime(data['created_at'])
        
        df_tmp = get_lag_features(data, target_column)
        df_tmp = get_other_features(df_tmp)
        
        return df_tmp

    @staticmethod
    def feature_eng_hourly_training_data(
        data, target_column
    ):
        def get_lag_features(df_tmp, TARGET_COL):
            df_tmp = df_tmp.sort_values(by=["created_at", "device_number"])
        
            shifts = [
                1,
                2,
            ]  # TODO: Review to increase these both in training and the actual job
            for s in shifts:
                df_tmp[f"pm2_5_last_{s}_hour"] = df_tmp.groupby(["device_number"])[
                    TARGET_COL
                ].shift(s)
        
            # lag features
            shifts = [6, 12, 24, 48]
            functions = ["mean", "std", "median", "skew"]
            for s in shifts:
                for f in functions:
                    df_tmp[f"pm2_5_{f}_{s}_hour"] = (
                        df_tmp.groupby(["device_number"])[TARGET_COL].shift(1).rolling(s).agg(f)
                    )
        
            return df_tmp

        def get_other_features(df_tmp):
            # TODO: Experiment on impact of features
            attributes = ["year", "month", "day", "dayofweek", "hour", "minute"]
        
            for a in attributes:
                df_tmp[a] = df_tmp["created_at"].dt.__getattribute__(a)
            df_tmp["week"] = df_tmp["created_at"].dt.isocalendar().week.astype(int)
        
            print("Additional features added")
            return df_tmp

        data['created_at'] = pd.to_datetime(data['created_at'])
        df_tmp = get_other_features(data)
        df_tmp = get_lag_features(df_tmp, target_column)
    
        return df_tmp

    @staticmethod
    def train_hourly_model(train):  # separate code for hourly model
        """
        Perform the actual training for hourly data
        """
        print("feature selection started.....")
        # sort values by both device_number and created_at
        train['created_at'] = pd.to_datetime(train['created_at'])
        train = train.sort_values(by=["device_number", "created_at"])
        features = [c for c in train.columns if c not in ["created_at", "pm2_5"]]
        print(features)
        target_col = "pm2_5"
        train_data, test_data = pd.DataFrame(), pd.DataFrame()


        def model_to_bytes(model):
            return joblib.dump(model, "hourly_model.pkl")
        for device_number in train["device_number"].unique():
            device_df = train[train["device_number"] == device_number]
            device_df = device_df.sort_values(by="created_at")
            months = device_df["created_at"].dt.month.unique()
            train_months = months[:4]
            test_months = months[4:]
            train_df = device_df[device_df["created_at"].dt.month.isin(train_months)]
            test_df = device_df[device_df["created_at"].dt.month.isin(test_months)]
            train_data = pd.concat([train_data, train_df])
            test_data = pd.concat([test_data, test_df])
    
        train_data["device_number"] = train_data["device_number"].astype(int)
        test_data["device_number"] = test_data["device_number"].astype(int)
        train_data.drop(columns=["created_at"], axis=1, inplace=True)
        test_data.drop(columns=["created_at"], axis=1, inplace=True)
    
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
                random_state=random_state,
            )
    
            clf.fit(
                train_data[features],
                train_target,
                eval_set=[(test_data[features], test_target)],
                callbacks=[early_stopping(stopping_rounds=150)],
                eval_metric="rmse",
            )
            print("Model training completed.....")
    
            # Log parameters
            mlflow.log_param("n_estimators", n_estimators)
            mlflow.log_param("learning_rate", learning_rate)
            mlflow.log_param("colsample_bytree", colsample_bytree)
            mlflow.log_param("reg_alpha", reg_alpha)
            mlflow.log_param("reg_lamba", reg_lambda)
            mlflow.log_param("max_depth", max_depth)
            mlflow.log_param("random_state", random_state)
    
            # Log moder
            mlflow.sklearn.log_model(
                sk_model=clf,
                artifact_path="hourly_forecast_model",
                registered_model_name=f"LGBM_hourly_forecast_model_development",
            )
    
            print("Being model validation.....")
    
            val_preds = clf.predict(test_data[features])
            rmse_val = mean_squared_error(test_data[target_col], val_preds) ** 0.5
    
            print("Model validation completed.....")
            print(f"Validation RMSE is {rmse_val}")
    
            # Log metrics
            mlflow.log_metric("VAL_RMSE", rmse_val)
    
            best_iter = clf.best_iteration_
            clf = LGBMRegressor(
                n_estimators=best_iter,
                learning_rate=0.05,
                colsample_bytree=0.4,
                reg_alpha=2,
                reg_lambda=1,
                max_depth=-1,
                random_state=1,
            )
            train["device_number"] = train["device_number"].astype(int)
            clf.fit(train[features], train[target_col])
            clf.booster_.save_model("hourly_model.json", format = "json")
        return model_json


    @staticmethod
    def train_daily_model(train):  # separate code for monthly model
        train['created_at'] = pd.to_datetime(train['created_at'])
        features = [c for c in train.columns if c not in ["created_at", "pm2_5"]]
        print(features)
        target_col = "pm2_5"
        train_data, test_data = pd.DataFrame(), pd.DataFrame()


        def model_to_bytes(model):
            return joblib.dump(model, "daily_model.pkl")

        for device_number in train["device_number"].unique():
            device_df = train[train["device_number"] == device_number]
            device_df = device_df.sort_values(by="created_at")
            months = device_df["created_at"].dt.month.unique()
            train_months = months[:9]
            test_months = months[9:]
            train_df = device_df[device_df["created_at"].dt.month.isin(train_months)]
            test_df = device_df[device_df["created_at"].dt.month.isin(test_months)]
            train_data = pd.concat([train_data, train_df])
            test_data = pd.concat([test_data, test_df])
        
        train_data["device_number"] = train_data["device_number"].astype(int)
        test_data["device_number"] = test_data["device_number"].astype(int)
        train_data.drop(columns=["created_at"], axis=1, inplace=True)
        test_data.drop(columns=["created_at"], axis=1, inplace=True)
        
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
                random_state=random_state,
            )
        
            clf.fit(
                train_data[features],
                train_target,
                eval_set=[(test_data[features], test_target)],
                callbacks=[early_stopping(stopping_rounds=150)],
                eval_metric="rmse",
            )
            print("Model training completed.....")
        
            # Log parameters
            mlflow.log_param("n_estimators", n_estimators)
            mlflow.log_param("learning_rate", learning_rate)
            mlflow.log_param("colsample_bytree", colsample_bytree)
            mlflow.log_param("reg_alpha", reg_alpha)
            mlflow.log_param("reg_lamba", reg_lambda)
            mlflow.log_param("max_depth", max_depth)
            mlflow.log_param("random_state", random_state)
        
            # Log model
            mlflow.sklearn.log_model(
                sk_model=clf,
                artifact_path="daily_forecast_model",
                registered_model_name=f"LGBM_daily_forecast_model_development",
            )
        
            # model validation
            print("Being model validation.....")
        
            val_preds = clf.predict(test_data[features])
            rmse_val = mean_squared_error(test_data[target_col], val_preds) ** 0.5
        
            print("Model validation completed.....")
            print(f"Validation RMSE is {rmse_val}")
        
            # Log metrics
            mlflow.log_metric("VAL_RMSE", rmse_val)
        
            best_iter = clf.best_iteration_
            clf = LGBMRegressor(
                n_estimators=best_iter,
                learning_rate=0.05,
                colsample_bytree=0.4,
                reg_alpha=2,
                reg_lambda=1,
                max_depth=-1,
                random_state=1,
            )
            train["device_number"] = train["device_number"].astype(int)
            clf.fit(train[features], train[target_col])

        model_json = model_to_bytes(clf)
        return model_json

    @staticmethod
    def upload_trained_model_to_gcs(
        trained_model, project_name, bucket_name, source_blob_name
    ):

        trained_model = model_to_bytes(trained_model)
        fs = gcsfs.GCSFileSystem(project=project_name)
    
        try:
            fs.rename(
                f"{bucket_name}/{source_blob_name}",
                f"{bucket_name}/{datetime.now()}-{source_blob_name}",
            )
            print("Bucket: previous model is backed up")
        except:
            print("Bucket: No file to updated")
    
        # store new model
        with fs.open(bucket_name + "/" + source_blob_name, "wb") as handle:
            job = joblib.dump(trained_model, handle)
    @staticmethod
    def preprocess_forecast_data(hourly_df, daily_df, fixed_columns):
        """Preprocess data before making forecasts"""
        print('preprocess_forecast_data started.....')

        for forecast_data in [hourly_df, daily_df]:
            # Common preprocessing steps
            forecast_data['created_at'] = pd.to_datetime(forecast_data['created_at'])
            forecast_data['pm2_5'] = forecast_data.groupby(fixed_columns + ['device_number'])['pm2_5'].transform(
                lambda x: x.interpolate(method='linear', limit_direction='both'))
            forecast_data = forecast_data.dropna(subset=['pm2_5'])  # no data at all for the device
            forecast_data['device_number'] = forecast_data['device_number'].astype(str)

            if forecast_data is daily_df:
                forecast_data = forecast_data.groupby(fixed_columns +
                                                      ['device_number']).resample('D', on='created_at').mean(
                    numeric_only=True)
                forecast_data = forecast_data.reset_index()

            forecast_data.sort_values(
                by=fixed_columns + ['device_number',
                                    'created_at'], inplace=True)
        print('preprocess_forecast_data completed.....')
        return hourly_df, daily_df

    @staticmethod
    def get_lag_features(df_hourly, df_daily, target_column):
        hourly_shifts = [1, 2, 6, 12, 24, 48]
        daily_shifts = [1, 2, 3, 7, 14, 30]
        hourly_functions = ['mean', 'std', 'median', 'skew']
        daily_functions = ['mean', 'std', 'max', 'min']

        for df, shifts, functions in zip([df_hourly, df_daily], [hourly_shifts, daily_shifts],
                                         [hourly_functions, daily_functions]):
            df = df.sort_values(by=['device_number', 'created_at'])
            for s in shifts:
                df[f'pm2_5_last_{s}'] = df.groupby(['device_number'])[target_column].shift(s)

            for s in shifts:
                for f in functions:
                    df[f'pm2_5_{f}_{s}'] = df.groupby(['device_number'])[target_column].shift(1).rolling(s).agg(f)
        print("Adding lag features")

        return df_hourly, df_daily

    @staticmethod
    def get_other_features(df_hourly, df_daily):
        hourly_attributes = ['year', 'month', 'day', 'dayofweek', 'hour', 'minute']
        daily_attributes = ['year', 'month', 'day', 'dayofweek']

        for df, attributes in zip([df_hourly, df_daily], [hourly_attributes, daily_attributes]):
            for a in attributes:
                df[a] = df['created_at'].dt.__getattribute__(a)

            df['week'] = df['created_at'].dt.isocalendar().week
        print("Adding other features")

        return df_hourly, df_daily

    @staticmethod
    def get_df_forecasts(model, hourly_df, daily_df):
        def get_new_row(df_tmp, fixed_columns, device, model, time_unit, hour_shifts, day_shifts, hour_functions,
                        day_functions):
            last_row = df_tmp[df_tmp["device_number"] == device].iloc[-1]
            new_row = pd.Series(index=last_row.index, dtype='float64')
            for i in fixed_columns:
                new_row[i] = last_row[i]
            new_row["created_at"] = last_row["created_at"] + pd.Timedelta(**{time_unit: 1})
            new_row["device_number"] = device

            if time_unit == 'hours':
                shifts = hour_shifts
                functions = hour_functions
            elif time_unit == 'days':
                shifts = day_shifts
                functions = day_functions

            for s in shifts:
                for f in functions:
                    computations = {
                        "mean": (last_row["pm2_5"] + last_row[f'pm2_5_{f}_{s}_{time_unit}'] * (s - 1)) / s,
                        "std": np.sqrt((last_row["pm2_5"] - last_row[f'pm2_5_mean_{s}_{time_unit}']) ** 2 + (
                                last_row[f'pm2_5_{f}_{s}_{time_unit}'] ** 2 * (s - 1))) / s,
                        "max": max(last_row["pm2_5"], last_row[f'pm2_5_{f}_{s}_{time_unit}']),
                        "min": min(last_row["pm2_5"], last_row[f'pm2_5_{f}_{s}_{time_unit}']),
                        "median": np.median(np.append(last_row["pm2_5"], last_row[f'pm2_5_{f}_{s}_{time_unit}'])),
                        "skew": skew(np.append(last_row["pm2_5"], last_row[f'pm2_5_{f}_{s}_{time_unit}']))
                    }
                    new_row[f'pm2_5_{f}_{s}_{time_unit}'] = computations.get(f)

            attributes = ['year', 'month', 'day', 'dayofweek', 'hour', 'minute']
            for a in attributes:
                new_row[a] = new_row['created_at'].__getattribute__(a) if a in dir(last_row['created_at']) else \
                    last_row[a]
            new_row['week'] = new_row["created_at"].isocalendar().week

            new_row["pm2_5"] = \
                model.predict(new_row.drop(
                    fixed_columns + ["created_at", "pm2_5"]).values.reshape(1, -1))[0]
            return new_row

        def get_forecasts(model, forecast_horizon, time_unit, hour_shifts, day_shifts, hour_functions,
                          day_functions, forecast_data):
            print(f'Getting next {forecast_horizon} {time_unit} forecasts')
            test_forecast_data = forecast_data.copy()
            forecasts = pd.DataFrame()

            for device in test_forecast_data["device_number"].unique():
                test_copy = test_forecast_data[test_forecast_data["device_number"] == device]
                for _ in range(int(forecast_horizon)):
                    new_row = get_new_row(test_copy, device, model, time_unit, hour_shifts, day_shifts, hour_functions,
                                          day_functions)
                    test_copy = pd.concat([test_copy, new_row.to_frame().T], ignore_index=True)
                forecasts = pd.concat([forecasts, test_copy], ignore_index=True)

            forecasts['device_number'] = forecasts['device_number'].astype(int)
            forecasts['pm2_5'] = forecasts['pm2_5'].astype(float)
            forecasts.rename(columns={'created_at': 'time'}, inplace=True)
            forecasts['time'] = pd.to_datetime(forecasts['time'], utc=True)
            current_time = datetime.utcnow()
            current_time_utc = pd.Timestamp(current_time, tz='UTC')
            result = forecasts[fixed_columns + ['time', 'pm2_5', 'device_number']][
                forecasts['time'] >= current_time_utc]

            return result

        next_24_hour_forecasts = get_forecasts(model, 24, 'hours', [6, 12, 24, 48], [],
                                               ['mean', 'std', 'median', 'skew'], [], hourly_df)
        next_1_week_forecasts = get_forecasts(model, 7, 'days', [], [3, 7, 14, 30], [],
                                              ['mean', 'std', 'max', 'min'], daily_df)
        return next_24_hour_forecasts, next_1_week_forecasts

    @staticmethod
    def save_forecasts_to_bigquery(df_hourly, df_daily, hourly_table, daily_table):
        """saves the dataframes to the bigquery tables"""

        # Save the hourly dataframe
        df_hourly.to_gbq(
            destination_table=f"{configuration.GOOGLE_CLOUD_PROJECT_ID}.{configuration.BIGQUERY_DATASET}.{hourly_table}",
            project_id=configuration.GOOGLE_CLOUD_PROJECT_ID,
            if_exists='append',
            credentials=credentials)

        print("Hourly data saved to bigquery")

        # Save the daily dataframe
        df_daily.to_gbq(
            destination_table=f"{configuration.GOOGLE_CLOUD_PROJECT_ID}.{configuration.BIGQUERY_DATASET}.{daily_table}",
            project_id=configuration.GOOGLE_CLOUD_PROJECT_ID,
            if_exists='append',
            credentials=credentials)

        print("Daily data saved to bigquery")
