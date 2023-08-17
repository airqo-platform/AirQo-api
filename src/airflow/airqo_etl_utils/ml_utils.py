from datetime import datetime

import gcsfs
import joblib
import mlflow
import numpy as np
import pandas as pd
import pymongo as pm
from lightgbm import LGBMRegressor, early_stopping
from scipy.stats import skew
from sklearn.metrics import mean_squared_error

from .config import configuration

fixed_columns = ["site_id"]
project_id = configuration.GOOGLE_CLOUD_PROJECT_ID
bucket = configuration.FORECAST_MODELS_BUCKET


def get_trained_model_from_gcs(project_name, bucket_name, source_blob_name):
    fs = gcsfs.GCSFileSystem(project=project_name)
    fs.ls(bucket_name)
    with fs.open(bucket_name + "/" + source_blob_name, "rb") as handle:
        job = joblib.load(handle)
    return job


def upload_trained_model_to_gcs(
    trained_model, project_name, bucket_name, source_blob_name
):
    fs = gcsfs.GCSFileSystem(project=project_name)

    # backup previous model
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


class ForecastUtils:
    ###FORECAST MODEL TRAINING UTILS####
    @staticmethod
    def preprocess_training_data(data, frequency):
        data["created_at"] = pd.to_datetime(data["created_at"])
        data["device_number"] = data["device_number"].astype(str)
        data["pm2_5"] = data.groupby("device_number")["pm2_5"].transform(
            lambda x: x.interpolate(method="linear", limit_direction="both")
        )
        if frequency == "daily":
            data = (
                data.groupby(["device_number"])
                .resample("D", on="created_at")
                .mean(numeric_only=True)
            )
            data.reset_index(inplace=True)
            data["pm2_5"] = data.groupby("device_number")["pm2_5"].transform(
                lambda x: x.interpolate(method="linear", limit_direction="both")
            )
        data["device_number"] = data["device_number"].astype(int)
        data = data.dropna(subset=["pm2_5"])
        return data

    @staticmethod
    def feature_eng_training_data(data, target_column, frequency):
        def get_lag_features(df, target_col, freq):
            df = df.sort_values(by=["device_number", "created_at"])

            if freq == "daily":
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
                            df.groupby(["device_number"])[target_col]
                            .shift(1)
                            .rolling(s)
                            .agg(f)
                        )
            elif freq == "hourly":
                shifts = [
                    1,
                    2,
                ]  # TODO: Review to increase these both in training and the actual job
                for s in shifts:
                    df[f"pm2_5_last_{s}_hour"] = df.groupby(["device_number"])[
                        target_col
                    ].shift(s)

                # lag features
                shifts = [6, 12, 24, 48]
                functions = ["mean", "std", "median", "skew"]
                for s in shifts:
                    for f in functions:
                        df[f"pm2_5_{f}_{s}_hour"] = (
                            df.groupby(["device_number"])[target_col]
                            .shift(1)
                            .rolling(s)
                            .agg(f)
                        )
            else:
                raise ValueError("Invalid frequency")

            return df

        def get_other_features(df_tmp, freq):
            # TODO: Experiment on impact of features
            attributes = ["year", "month", "day", "dayofweek"]
            if freq == "hourly":
                attributes.extend(["hour", "minute"])
            for a in attributes:
                df_tmp[a] = df_tmp["created_at"].dt.__getattribute__(a)
            df_tmp["week"] = df_tmp["created_at"].dt.isocalendar().week.astype(int)

            print("Additional features added")
            return df_tmp

        data["created_at"] = pd.to_datetime(data["created_at"])
        df_tmp = get_other_features(data, frequency)
        df_tmp = get_lag_features(df_tmp, target_column, frequency)

        return df_tmp

    @staticmethod
    def train_and_save_hourly_forecast_model(train):  # separate code for hourly model
        """
        Perform the actual training for hourly data
        """
        train["created_at"] = pd.to_datetime(train["created_at"])
        train = train.sort_values(by=["device_number", "created_at"])
        features = [c for c in train.columns if c not in ["created_at", "pm2_5"]]
        print(features)
        target_col = "pm2_5"
        train_data, test_data = pd.DataFrame(), pd.DataFrame()
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
                verbosity=2,
            )
            train["device_number"] = train["device_number"].astype(int)
            clf.fit(train[features], train[target_col])
        upload_trained_model_to_gcs(clf, project_id, bucket, "hourly_forecast_model")

    @staticmethod
    def train_and_save_daily_forecast_model(train):  # separate code for monthly model
        train["created_at"] = pd.to_datetime(train["created_at"])
        train = train.sort_values(by=["device_number", "created_at"])
        features = [c for c in train.columns if c not in ["created_at", "pm2_5"]]
        print(features)
        target_col = "pm2_5"
        train_data, test_data = pd.DataFrame(), pd.DataFrame()

        for device_number in train["device_number"].unique():
            device_df = train[train["device_number"] == device_number]
            device_df = device_df.sort_values(by="created_at")
            months = device_df["created_at"].dt.month.unique()
            train_months = months[:8]
            test_months = months[8:]
            train_df = device_df[device_df["created_at"].dt.month.isin(train_months)]
            test_df = device_df[device_df["created_at"].dt.month.isin(test_months)]
            train_data = pd.concat([train_data, train_df])
            test_data = pd.concat([test_data, test_df])

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
            clf.fit(train[features], train[target_col])
        upload_trained_model_to_gcs(clf, project_id, bucket, "daily_forecast_model.pkl")
        print("Model saved successfully")

    #### FORECAST JOB UTILS ####

    @staticmethod
    def preprocess_historical_data(data, frequency):
        data["created_at"] = pd.to_datetime(data["created_at"])
        data["device_number"] = data["device_number"].astype(str)
        data["pm2_5"] = data.groupby(fixed_columns + ["device_number"])[
            "pm2_5"
        ].transform(lambda x: x.interpolate(method="linear", limit_direction="both"))
        if frequency == "hourly":
            data.sort_values(
                by=fixed_columns + ["device_number", "created_at"], inplace=True
            )
        elif frequency == "daily":
            data = (
                data.groupby(fixed_columns + ["device_number"])
                .resample("D", on="created_at")
                .mean(numeric_only=True)
            )
            data.reset_index(inplace=True)
            data["pm2_5"] = data.groupby(fixed_columns + ["device_number"])[
                "pm2_5"
            ].transform(
                lambda x: x.interpolate(method="linear", limit_direction="both")
            )
            data.sort_values(
                by=fixed_columns + ["device_number", "created_at"], inplace=True
            )
        else:
            raise ValueError("Invalid frequency argument")
        data["device_number"] = data["device_number"].astype(int)
        data = data.dropna(subset=["pm2_5"])
        return data

    @staticmethod
    def get_lag_features(df_tmp, TARGET_COL, frequency):
        df_tmp["created_at"] = pd.to_datetime(df_tmp["created_at"])
        df_tmp = df_tmp.sort_values(by=fixed_columns + ["device_number", "created_at"])
        if frequency == "hourly":
            shifts = [1, 2]
            for s in shifts:
                df_tmp[f"pm2_5_last_{s}_hour"] = df_tmp.groupby(["device_number"])[
                    TARGET_COL
                ].shift(s)

            shifts = [6, 12, 24, 48]
            functions = ["mean", "std", "median", "skew"]
            for s in shifts:
                for f in functions:
                    df_tmp[f"pm2_5_{f}_{s}_hour"] = (
                        df_tmp.groupby(["device_number"])[TARGET_COL]
                        .shift(1)
                        .rolling(s)
                        .agg(f)
                    )
        elif frequency == "daily":
            shifts = [1, 2]
            for s in shifts:
                df_tmp[f"pm2_5_last_{s}_day"] = df_tmp.groupby(["device_number"])[
                    TARGET_COL
                ].shift(s)
            shifts = [3, 7, 14, 30]
            functions = ["mean", "std", "max", "min"]
            for s in shifts:
                for f in functions:
                    df_tmp[f"pm2_5_{f}_{s}_day"] = (
                        df_tmp.groupby(["device_number"])[TARGET_COL]
                        .shift(1)
                        .rolling(s)
                        .agg(f)
                    )
        else:
            raise ValueError("Invalid frequency argument")
        print("Adding lag features")
        return df_tmp

    @staticmethod
    def get_time_features(df_tmp, frequency):
        df_tmp["created_at"] = pd.to_datetime(df_tmp["created_at"])
        attributes = ["year", "month", "day", "dayofweek"]
        if frequency == "hourly":
            attributes.extend(["hour", "minute"])
        for a in attributes:
            df_tmp[a] = df_tmp["created_at"].dt.__getattribute__(a)

        df_tmp["week"] = df_tmp["created_at"].dt.isocalendar().week
        print("Adding other features")
        return df_tmp

    @staticmethod
    def generate_hourly_forecasts(data, project_name, bucket_name, source_blob_name):
        data["created_at"] = pd.to_datetime(data["created_at"])

        def get_new_row(df, device1, model):
            last_row = df[df["device_number"] == device1].iloc[-1]
            new_row = pd.Series(index=last_row.index, dtype="float64")
            for i in fixed_columns:
                new_row[i] = last_row[i]
            new_row["created_at"] = last_row["created_at"] + pd.Timedelta(hours=1)
            new_row["device_number"] = device1
            new_row[f"pm2_5_last_1_hour"] = last_row["pm2_5"]
            new_row[f"pm2_5_last_2_hour"] = last_row[f"pm2_5_last_{1}_hour"]

            shifts = [6, 12, 24, 48]
            functions = ["mean", "std", "median", "skew"]
            for s in shifts:
                for f in functions:
                    if f == "mean":
                        new_row[f"pm2_5_{f}_{s}_hour"] = (
                            last_row["pm2_5"]
                            + last_row[f"pm2_5_{f}_{s}_hour"] * (s - 1)
                        ) / s
                    elif f == "std":
                        new_row[f"pm2_5_{f}_{s}_hour"] = (
                            np.sqrt(
                                (last_row["pm2_5"] - last_row[f"pm2_5_mean_{s}_hour"])
                                ** 2
                                + (last_row[f"pm2_5_{f}_{s}_hour"] ** 2 * (s - 1))
                            )
                            / s
                        )
                    elif f == "median":
                        new_row[f"pm2_5_{f}_{s}_hour"] = np.median(
                            np.append(
                                last_row["pm2_5"], last_row[f"pm2_5_{f}_{s}_hour"]
                            )
                        )
                    elif f == "skew":
                        new_row[f"pm2_5_{f}_{s}_hour"] = skew(
                            np.append(
                                last_row["pm2_5"], last_row[f"pm2_5_{f}_{s}_hour"]
                            )
                        )

            attributes = ["year", "month", "day", "dayofweek", "hour", "minute"]
            for a in attributes:
                new_row[a] = new_row["created_at"].__getattribute__(a)
                new_row["week"] = new_row["created_at"].isocalendar().week

            new_row["pm2_5"] = model.predict(
                new_row.drop(fixed_columns + ["created_at", "pm2_5"]).values.reshape(
                    1, -1
                )
            )[0]
            return new_row

        forecasts = pd.DataFrame()
        forecast_model = get_trained_model_from_gcs(
            project_name, bucket_name, source_blob_name
        )
        df_tmp = data.copy()
        for device in df_tmp["device_number"].unique():
            test_copy = df_tmp[df_tmp["device_number"] == device]
            for i in range(int(configuration.HOURLY_FORECAST_HORIZON)):
                new_row = get_new_row(
                    test_copy,
                    device,
                    forecast_model
                )
                test_copy = pd.concat(
                    [test_copy, new_row.to_frame().T], ignore_index=True
                )
            forecasts = pd.concat([forecasts, test_copy], ignore_index=True)

        forecasts["device_number"] = forecasts["device_number"].astype(int)
        forecasts["pm2_5"] = forecasts["pm2_5"].astype(float)
        forecasts.rename(columns={"created_at": "time"}, inplace=True)
        forecasts["time"] = pd.to_datetime(forecasts["time"], utc=True)
        current_time = datetime.utcnow()
        current_time_utc = pd.Timestamp(current_time, tz="UTC")
        result = forecasts[fixed_columns + ["time", "pm2_5", "device_number"]][
            forecasts["time"] >= current_time_utc
        ]

        return result

    @staticmethod
    def generate_daily_forecasts(data, project_name, bucket_name, source_blob_name):
        data["created_at"] = pd.to_datetime(data["created_at"])

        def get_new_row(
            df_tmp, device, model
        ):
            last_row = df_tmp[df_tmp["device_number"] == device].iloc[-1]
            new_row = pd.Series(index=last_row.index, dtype="float64")
            for i in fixed_columns:
                new_row[i] = last_row[i]
            new_row["created_at"] = last_row["created_at"] + pd.Timedelta(days=1)
            new_row["device_number"] = device
            new_row[f"pm2_5_last_1_day"] = last_row["pm2_5"]
            new_row[f"pm2_5_last_2_day"] = last_row[f"pm2_5_last_{1}_day"]

            shifts = [3, 7, 14, 30]
            functions = ["mean", "std", "max", "min"]
            for s in shifts:
                for f in functions:
                    if f == "mean":
                        new_row[f"pm2_5_{f}_{s}_day"] = (
                            last_row["pm2_5"] + last_row[f"pm2_5_{f}_{s}_day"] * (s - 1)
                        ) / s
                    elif f == "std":
                        new_row[f"pm2_5_{f}_{s}_day"] = (
                            np.sqrt(
                                (last_row["pm2_5"] - last_row[f"pm2_5_mean_{s}_day"])
                                ** 2
                                + (last_row[f"pm2_5_{f}_{s}_day"] ** 2 * (s - 1))
                            )
                            / s
                        )
                    elif f == "max":
                        new_row[f"pm2_5_{f}_{s}_day"] = max(
                            last_row["pm2_5"], last_row[f"pm2_5_{f}_{s}_day"]
                        )
                    elif f == "min":
                        new_row[f"pm2_5_{f}_{s}_day"] = min(
                            last_row["pm2_5"], last_row[f"pm2_5_{f}_{s}_day"]
                        )

                        # Use the date of the new row to create other features
            attributes = ["year", "month", "day", "dayofweek"]
            for a in attributes:
                new_row[a] = new_row["created_at"].__getattribute__(a)
            new_row["week"] = new_row["created_at"].isocalendar().week

            new_row["pm2_5"] = model.predict(
                new_row.drop(
                    fixed_columns
                    + ["created_at", "pm2_5"]
                ).values.reshape(1, -1)
            )[0]
            return new_row

        forecasts = pd.DataFrame()

        forecast_model = get_trained_model_from_gcs(
            project_name, bucket_name, source_blob_name
        )

        df_tmp = data.copy()
        for device in df_tmp["device_number"].unique():
            test_copy = df_tmp[df_tmp["device_number"] == device]
            for i in range(int(configuration.DAILY_FORECAST_HORIZON)):
                new_row = get_new_row(
                    test_copy,
                    device,
                    forecast_model,
                )
                test_copy = pd.concat(
                    [test_copy, new_row.to_frame().T], ignore_index=True
                )
            forecasts = pd.concat([forecasts, test_copy], ignore_index=True)
        forecasts["device_number"] = forecasts["device_number"].astype(int)
        forecasts["pm2_5"] = forecasts["pm2_5"].astype(float)
        forecasts.rename(columns={"created_at": "time"}, inplace=True)
        current_time = datetime.utcnow()
        current_time_utc = pd.Timestamp(current_time, tz="UTC")
        result = forecasts[
            fixed_columns
            + ["time", "pm2_5", "device_number"]
        ][forecasts["time"] >= current_time_utc]

        return result

    @staticmethod
    def save_forecasts_to_mongo(data, frequency):
        created_at = pd.to_datetime(datetime.now()).isoformat()
        device_numbers = data["device_number"].unique()
        forecast_results = [
            {
                field: data[data["device_number"] == i][field].tolist()[0]
                if field != "pm2_5" and field != "time" and field != "health_tips"
                else data[data["device_number"] == i][field].tolist()
                for field in data.columns
            }
            | {"created_at": created_at}
            for i in device_numbers
        ]
        client = pm.MongoClient(configuration.MONGO_URI)
        db = client[configuration.MONGO_DATABASE_NAME]
        if frequency == "hourly":
            db.hourly_forecasts.insert_many(forecast_results)
        elif frequency == "daily":
            db.daily_forecasts.insert_many(forecast_results)
        else:
            raise ValueError("Invalid frequency argument")
