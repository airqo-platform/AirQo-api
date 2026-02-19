from datetime import datetime, timedelta
from typing import Dict, List, Any , Iterable, Sequence,  Optional, Tuple


from pandas.io.formats.style import Subset
from pymongo.errors import ServerSelectionTimeoutError

import gcsfs
import joblib
import mlflow
import numpy as np
import optuna
import pandas as pd
import pymongo as pm
import lightgbm as lgb
from lightgbm import LGBMRegressor, early_stopping
from sklearn.metrics import mean_squared_error
from sklearn.preprocessing import OneHotEncoder, LabelEncoder
from pathlib import Path
from .config import configuration, db
from .constants import Frequency
from .commons import download_file_from_gcs
 
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score 



import logging

logger = logging.getLogger("airflow.task")


project_id = configuration.GOOGLE_CLOUD_PROJECT_ID
bucket = configuration.FORECAST_MODELS_BUCKET
environment = configuration.ENVIRONMENT
additional_columns = ["site_id"]

pd.options.mode.chained_assignment = None


### This module contains utility functions for ML jobs.


class GCSUtils:
    """Utility class for saving and retrieving models from GCS"""

    # TODO: In future, save and retrieve models from mlflow instead of GCS
    @staticmethod
    def get_trained_model_from_gcs(project_name, bucket_name, source_blob_name):
        """
        Retrieves a trained model from Google Cloud Storage (GCS). If the specified model file
        does not exist, an exception is raised.

        Args:
            project_name (str): The GCP project name.
            bucket_name (str): The name of the GCS bucket containing the model files.
            source_blob_name (str): The file path of the trained model in the GCS bucket.

        Returns:
            object: The trained model loaded using joblib.

        Raises:
            FileNotFoundError: If the requested model does not exist.
        """
        file_path = None
        try:
            if not Path(source_blob_name).exists():
                file_path = download_file_from_gcs(
                    bucket_name, source_blob_name, source_blob_name
                )
        except FileNotFoundError as e:
            logger.warning(
                f"Requested model '{source_blob_name}' not found in '{bucket_name}': {e}"
            )
            raise
        except Exception as e:
            logger.warning(
                f"Error loading requested model '{source_blob_name}' from '{bucket_name}': {e}"
            )
            raise

        try:
            file_path = source_blob_name if file_path is None else file_path
            with open(file_path, "rb") as file:
                model = joblib.load(file)
        except Exception as e:
            logger.error(f"Error loading model from file '{file_path}': {e}")
            raise

        return model

    @staticmethod
    def upload_trained_model_to_gcs(
        trained_model, project_name, bucket_name, source_blob_name
    ):
        fs = gcsfs.GCSFileSystem(project=project_name)
        try:
            fs.rename(
                f"{bucket_name}/{source_blob_name}",
                f"{bucket_name}/{datetime.now()}-{source_blob_name}",
            )
            print("Bucket: previous model is backed up")
        except:
            print("Bucket: No file to updated")

        with fs.open(bucket_name + "/" + source_blob_name, "wb") as handle:
            job = joblib.dump(trained_model, handle)


class BaseMlUtils:
    """Base Utility class for ML related tasks"""

    # TODO: need to review this, may need to make better abstractions

    @staticmethod
    def preprocess_data(
        data: pd.DataFrame, data_frequency: Frequency, job_type: str
    ) -> pd.DataFrame:
        """
        Preprocess the input DataFrame for time series analysis or prediction.

        This function checks for the presence of necessary columns, converts the 'timestamp' column to datetime format, and performs interpolation to fill
        missing values in the 'pm2_5' column. It also resamples the data based on the specified frequency.

        Args:
        data(pd.DataFrame): The input DataFrame containing time series data. It must include 'device_id', 'pm2_5', and 'timestamp' columns.
        data_frequency(Frequency): A Frequency object that indicates the frequency of the time series data (e.g daily, hourly).
        job_type(str): A string indicating the type of job being performed. If the job type is "prediction", additional columns may be included for grouping.

         Returns:
            pd.DataFrame: The preprocessed DataFrame with interpolated 'pm2_5' values and resampled according to the specified frequency. Any rows with NaN values in 'pm2_5' are dropped.

        Raises:
            ValueError: If the input DataFrame is missing any required columns or if there is an error in converting the 'timestamp' column to datetime format.

        Notes:
            - The function performs linear interpolation on the 'pm2_5' column to fill missing values, applying this operation in both forward and backward directions.
            - When the frequency is daily, the function resamples the data to daily frequency and takes the mean of the numeric columns.
            - After preprocessing, rows with NaN values in 'pm2_5' are dropped to ensure data integrity.
        """
        required_columns = {
            "device_id",
            "pm2_5",
            "timestamp",
        }
        if not required_columns.issubset(data.columns):
            missing_columns = required_columns.difference(data.columns)
            raise ValueError(
                f"Provided dataframe missing necessary columns: {', '.join(missing_columns)}"
            )
        try:
            data["timestamp"] = pd.to_datetime(data["timestamp"])
        except ValueError as e:
            raise ValueError(
                "datetime conversion error, please provide timestamp in valid format"
            )
        group_columns = (
            ["device_id"] + additional_columns
            if job_type == "prediction"
            else ["device_id"]
        )
        data["pm2_5"] = data.groupby(group_columns)["pm2_5"].transform(
            lambda x: x.interpolate(method="linear", limit_direction="both")
        )
        if data_frequency.str == "daily":
            data = (
                data.groupby(group_columns)
                .resample("D", on="timestamp")
                .mean(numeric_only=True)
            )
            data.reset_index(inplace=True)
        data["pm2_5"] = data.groupby(group_columns)["pm2_5"].transform(
            lambda x: x.interpolate(method="linear", limit_direction="both")
        )
        data = data.dropna(subset=["pm2_5"])
        return data

    @staticmethod
    def get_lag_and_roll_features(
        df: pd.DataFrame, target_col: str, freq: Frequency
    ) -> pd.DataFrame:
        """
        Generate lag and rolling statistical features for a specified target column in a DataFrame.

        This function calculates lag features (previous values) and rolling statistics (mean, standard deviation, etc.) for the specified target column, grouped by device ID. It supports both daily and hourly frequency data.

        Args:
            df(pd.DataFrame): A DataFrame containing time series data. It must include 'timestamp', 'device_id', and the target column specified by `target_col`.
            target_col(str):The name of the column for which lag and rolling features are to be calculated.
            freq(Frequency): A Frequency object that indicates the frequency of the time series data (e.g., daily, hourly).

        Returns:
            pd.DataFrame: A DataFrame with additional columns for lag and rolling features based on the specified target column, grouped by device ID.

        Raises:
            ValueError: If the DataFrame is empty, if any of the required columns ('timestamp', 'device_id', target_col) are missing, or if the specified frequency is invalid.

        Notes:
            The function calculates the following features:
            - For daily frequency:
                - Lag features for the last 1, 2, 3, and 7 days.
                - Rolling statistics (mean, standard deviation, max, min) for the last 2, 3, and 7 days.

            - For hourly frequency:
                - Lag features for the last 1, 2, 6, and 12 hours.
                - Rolling statistics (mean, standard deviation, median, skew) for the last 3, 6, 12, and 24 hours.
        """
        if df.empty:
            raise ValueError("Empty dataframe provided")

        if (
            target_col not in df.columns
            or "timestamp" not in df.columns
            or "device_id" not in df.columns
        ):
            raise ValueError("Required columns missing")

        df["timestamp"] = pd.to_datetime(df["timestamp"])

        df1 = df.copy()  # use copy to prevent terminal warning
        if freq.str == "daily":
            shifts = [1, 2, 3, 7]
            for s in shifts:
                df1[f"pm2_5_last_{s}_day"] = df1.groupby(["device_id"])[
                    target_col
                ].shift(s)
            shifts = [2, 3, 7]
            functions = ["mean", "std", "max", "min"]
            for s in shifts:
                for f in functions:
                    df1[f"pm2_5_{f}_{s}_day"] = (
                        df1.groupby(["device_id"])[target_col]
                        .shift(1)
                        .rolling(s)
                        .agg(f)
                    )
        elif freq.str == "hourly":
            shifts = [1, 2, 6, 12]
            for s in shifts:
                df1[f"pm2_5_last_{s}_hour"] = df1.groupby(["device_id"])[
                    target_col
                ].shift(s)
            shifts = [3, 6, 12, 24]
            functions = ["mean", "std", "median", "skew"]
            for s in shifts:
                for f in functions:
                    df1[f"pm2_5_{f}_{s}_hour"] = (
                        df1.groupby(["device_id"])[target_col]
                        .shift(1)
                        .rolling(s)
                        .agg(f)
                    )
        else:
            raise ValueError("Invalid frequency")
        return df1

    @staticmethod
    def get_time_features(df: pd.DataFrame, freq: Frequency) -> pd.DataFrame:
        """
        Extracts time-based features from a timestamp column in a DataFrame.

        Args:
            df(pd.DataFrame): The input DataFrame containing a "timestamp" column.
            freq(Frequency): The frequency of the data, either "daily" or "hourly".

        Returns:
            pd.DataFrame: A new DataFrame with additional time-based features.

        Raises:
            ValueError: If the input DataFrame is empty.
            ValueError: If the "timestamp" column is missing.
            ValueError: If an invalid frequency is provided.

        Example:
            >>> df = pd.DataFrame({"timestamp": ["2025-02-01 12:00:00", "2024-02-02 14:30:00"]})
            >>> df = get_time_features(df, Frequency)
            >>> df.columns
            Index(['timestamp', 'year', 'month', 'day', 'dayofweek', 'hour', 'week'], dtype='object')
        """
        if df.empty:
            raise ValueError("Empty dataframe provided")

        if "timestamp" not in df.columns:
            raise ValueError("Required columns missing")

        df["timestamp"] = pd.to_datetime(df["timestamp"])

        if freq.str not in {"daily", "hourly"}:
            raise ValueError(
                f"Invalid frequency '{freq.str}', must be 'daily' or 'hourly'"
            )

        attributes = ["year", "month", "day", "dayofweek"]
        if freq.str == "hourly":
            attributes.append("hour")

        attributes = {
            "year": df["timestamp"].dt.year,
            "month": df["timestamp"].dt.month,
            "day": df["timestamp"].dt.day,
            "dayofweek": df["timestamp"].dt.dayofweek,
            "week": df["timestamp"].dt.isocalendar().week,
        }

        if freq.str == "hourly":
            attributes["hour"] = df["timestamp"].dt.hour

        df = df.assign(**attributes)

        return df

    @staticmethod
    def get_cyclic_features(df: pd.DataFrame, freq: Frequency):
        """
        Generate cyclic features for time-based attributes in a DataFrame.

        This function takes a DataFrame containing time-related data and a frequency to compute sine and cosine transformations for cyclic features such as
        year, month, day, day of the week, and optionally hour, to capture seasonal patterns in the data.

        Args:
            df(pd.DataFrame): A DataFrame containing time-related attributes. The DataFrame is expected to have columns for year, month, day, dayofweek, and optionally hour and week.
            freq(Frequency): A Frequency object that indicates the frequency of the time series data(e.g hourly, daily).

        Returns:
            pd.DataFrame: A DataFrame with additional cyclic features for the specified time attributes. The new features are in the form of sine and cosine transformations of the
                original time attributes, which help in modeling cyclical behavior.

        Notes:
            - The function drops the original time attributes after creating the cyclic features.
            - The week attribute is also dropped after feature generation.
        """
        df1 = BaseMlUtils.get_time_features(df, freq)

        attributes = ["year", "month", "day", "dayofweek"]
        max_vals = [2023, 12, 30, 7]
        if freq.str == "hourly":
            attributes.append("hour")
            max_vals.append(23)

        for a, m in zip(attributes, max_vals):
            df1[a + "_sin"] = np.sin(2 * np.pi * df1[a] / m)
            df1[a + "_cos"] = np.cos(2 * np.pi * df1[a] / m)

        df1["week_sin"] = np.sin(2 * np.pi * df1["week"] / 52)
        df1["week_cos"] = np.cos(2 * np.pi * df1["week"] / 52)

        df1.drop(columns=attributes + ["week"], inplace=True)

        return df1

    @staticmethod
    def get_location_features(df: pd.DataFrame):
        """
        Generate 3D Cartesian coordinates from geographical coordinates (latitude and longitude).

        This function takes a DataFrame containing timestamp, latitude, and longitude columns, converts the timestamp to a datetime format, and calculates the
        corresponding 3D Cartesian coordinates (x, y, z) for each geographical point.

        Args:
            df(pd.DataFrame): A DataFrame containing at least three columns: 'timestamp', 'latitude', and 'longitude'. The latitude and longitude should be in radians for correct calculations.

        Returns:
            pd.DataFrame: The input DataFrame with additional columns for the calculated x, y, and z coordinates based on the geographical coordinates.

        Raises:
            ValueError: If the DataFrame is empty or if any of the required columns ('timestamp', 'latitude', 'longitude') are missing.

        Notes:
            - The latitude and longitude must be provided in radians for accurate calculations. If they are in degrees, they should be converted to radians prior to calling this function.
        """
        if df.empty:
            raise ValueError("Empty dataframe provided")

        for column_name in ["timestamp", "latitude", "longitude"]:
            if column_name not in df.columns:
                raise ValueError(f"{column_name} column is missing")

        df["timestamp"] = pd.to_datetime(df["timestamp"])

        df["x_cord"] = np.cos(df["latitude"]) * np.cos(df["longitude"])
        df["y_cord"] = np.cos(df["latitude"]) * np.sin(df["longitude"])
        df["z_cord"] = np.sin(df["latitude"])

        return df


class ForecastUtils(BaseMlUtils):
    @staticmethod
    def train_and_save_forecast_models(training_data, frequency):
        """
        Perform the actual training for hourly data
        """
        training_data.dropna(subset=["device_id"], inplace=True)
        training_data["timestamp"] = pd.to_datetime(training_data["timestamp"])
        features = [
            c
            for c in training_data.columns
            if c not in ["timestamp", "pm2_5", "latitude", "longitude", "device_id"]
        ]
        logger.info(features)

        target_col = "pm2_5"
        train_data = validation_data = test_data = pd.DataFrame()
        for device in training_data["device_id"].unique():
            device_df = training_data[training_data["device_id"] == device]
            months = device_df["timestamp"].dt.month.unique()
            train_months = months[:8]
            val_months = months[8:9]
            test_months = months[9:]

            train_df = device_df[device_df["timestamp"].dt.month.isin(train_months)]
            val_df = device_df[device_df["timestamp"].dt.month.isin(val_months)]
            test_df = device_df[device_df["timestamp"].dt.month.isin(test_months)]

            train_data = pd.concat([train_data, train_df])
            validation_data = pd.concat([validation_data, val_df])
            test_data = pd.concat([test_data, test_df])

        train_data.drop(columns=["timestamp", "device_id"], axis=1, inplace=True)
        validation_data.drop(columns=["timestamp", "device_id"], axis=1, inplace=True)
        test_data.drop(columns=["timestamp", "device_id"], axis=1, inplace=True)

        train_target, validation_target, test_target = (
            train_data[target_col],
            validation_data[target_col],
            test_data[target_col],
        )

        sampler = optuna.samplers.TPESampler()
        pruner = optuna.pruners.SuccessiveHalvingPruner(
            min_resource=10, reduction_factor=2, min_early_stopping_rate=0
        )
        study = optuna.create_study(
            direction="minimize", study_name="LGBM", sampler=sampler, pruner=pruner
        )

        def objective(trial):
            param_grid = {
                "colsample_bytree": trial.suggest_float("colsample_bytree", 0.1, 1),
                "reg_alpha": trial.suggest_float("reg_alpha", 0, 10),
                "reg_lambda": trial.suggest_float("reg_lambda", 0, 10),
                "n_estimators": trial.suggest_categorical("n_estimators", [50]),
                "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3),
                "num_leaves": trial.suggest_int("num_leaves", 20, 50),
                "max_depth": trial.suggest_int("max_depth", 4, 7),
            }
            score = 0
            for step in range(4):
                lgb_reg = LGBMRegressor(
                    objective="regression",
                    random_state=42,
                    **param_grid,
                    verbosity=2,
                )
                lgb_reg.fit(
                    train_data[features],
                    train_target,
                    eval_set=[(test_data[features], test_target)],
                    eval_metric="rmse",
                    callbacks=[early_stopping(stopping_rounds=150)],
                )

                val_preds = lgb_reg.predict(validation_data[features])
                score = mean_squared_error(validation_target, val_preds)
                if trial.should_prune():
                    raise optuna.TrialPruned()

            return score

        study.optimize(objective, n_trials=15)

        mlflow.set_tracking_uri(configuration.MLFLOW_TRACKING_URI)
        mlflow.set_experiment(f"{frequency}_forecast_model_{environment}")
        registered_model_name = f"{frequency}_forecast_model_{environment}"

        mlflow.lightgbm.autolog(
            registered_model_name=registered_model_name, log_datasets=False
        )
        with mlflow.start_run():
            best_params = study.best_params
            print(f"Best params are {best_params}")
            clf = LGBMRegressor(
                n_estimators=best_params["n_estimators"],
                learning_rate=best_params["learning_rate"],
                colsample_bytree=best_params["colsample_bytree"],
                reg_alpha=best_params["reg_alpha"],
                reg_lambda=best_params["reg_lambda"],
                max_depth=best_params["max_depth"],
                random_state=42,
                verbosity=2,
            )

            clf.fit(
                train_data[features],
                train_target,
                eval_set=[(test_data[features], test_target)],
                eval_metric="rmse",
                callbacks=[early_stopping(stopping_rounds=150)],
            )

            GCSUtils.upload_trained_model_to_gcs(
                clf, project_id, bucket, f"{frequency}_forecast_model.pkl"
            )

        # def create_error_df(data, target, preds):
        #     error_df = pd.DataFrame(
        #         {
        #             "actual_values": target,
        #             "predicted_values": preds,
        #         }
        #     )
        #     error_df["errors"] = (
        #         error_df["predicted_values"] - error_df["actual_values"]
        #     )
        #     error_df = pd.concat([error_df, data], axis=1)
        #     error_df.drop(["actual_values", "pm2_5"], axis=1, inplace=True)
        #     error_df.rename(columns={"predicted_values": "pm2_5"}, inplace=True)
        #
        #     return error_df
        #
        # error_df1 = create_error_df(
        #     train_data, train_target, clf.predict(train_data[features])
        # )
        # error_df2 = create_error_df(
        #     test_data, test_target, clf.predict(test_data[features])
        # )
        #
        # error_features1 = [c for c in error_df1.columns if c not in ["errors"]]
        # error_features2 = [c for c in error_df2.columns if c not in ["errors"]]
        #
        # error_target1 = error_df1["errors"]
        # error_target2 = error_df2["errors"]
        #
        # error_clf = LGBMRegressor(
        #     n_estimators=31,
        #     colsample_bytree=1,
        #     learning_rate=0.1,
        #     metric="rmse",
        #     max_depth=5,
        #     random_state=42,
        #     verbosity=2,
        # )
        #
        # error_clf.fit(
        #     error_df1[error_features1],
        #     error_target1,
        #     eval_set=[(error_df2[error_features2], error_target2)],
        #     categorical_feature=["device_id", "site_id", "device_category"],
        #     callbacks=[early_stopping(stopping_rounds=150)],
        # )
        #
        # GCSUtils.upload_trained_model_to_gcs(
        #     error_clf, project_id, bucket, f"{frequency}_error_model.pkl"
        # )

    # TODO: quantile regression approach
    # alphas = [0.025, 0.975]
    # models = []
    # names = [
    #     f"{frequency}_lower_quantile_model",
    #     f"{frequency}_upper_quantile_model",
    # ]
    #
    # for alpha in alphas:
    #     clf = LGBMRegressor(
    #         n_estimators=best_params["n_estimators"],
    #         learning_rate=best_params["learning_rate"],
    #         colsample_bytree=best_params["colsample_bytree"],
    #         reg_alpha=best_params["reg_alpha"],
    #         reg_lambda=best_params["reg_lambda"],
    #         max_depth=best_params["max_depth"],
    #         random_state=42,
    #         verbosity=2,
    #         objective="quantile",
    #         alpha=alpha,
    #         metric="quantile",
    #     )
    #     clf.fit(
    #         train_data[features],
    #         train_target,
    #         eval_set=[(test_data[features], test_target)],
    #         categorical_feature=["device_id", "site_id", "device_category"],
    #     )
    #     models.append(clf)
    # for n, m in zip(names, models):
    #     upload_trained_model_to_gcs(m, project_id, bucket, f"{n}.pkl")

    @staticmethod
    def generate_forecasts(
        data: pd.DataFrame, project_name: str, bucket_name: str, frequency: Frequency
    ) -> pd.DataFrame:
        data = data.dropna(subset=["site_id", "device_id"])
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data.columns = data.columns.str.strip()

        # data["margin_of_error"] = data["adjusted_forecast"] = 0

        def get_forecasts(df_tmp, forecast_model, frequency, horizon):
            """This method generates forecasts for a given device dataframe basing on horizon provided"""
            for i in range(int(horizon)):
                df_tmp = pd.concat([df_tmp, df_tmp.iloc[-1:]], ignore_index=True)
                df_tmp_no_ts = df_tmp.drop(
                    columns=["timestamp", "device_id", "site_id"], axis=1, inplace=False
                )
                # daily frequency
                if frequency == "daily":
                    df_tmp.tail(1)["timestamp"] += timedelta(days=1)
                    shifts1 = [1, 2, 3, 7]
                    for s in shifts1:
                        df_tmp[f"pm2_5_last_{s}_day"] = df_tmp.shift(s, axis=0)["pm2_5"]
                    # rolling features
                    shifts2 = [2, 3, 7]
                    functions = ["mean", "std", "max", "min"]
                    for s in shifts2:
                        for f in functions:
                            df_tmp[f"pm2_5_{f}_{s}_day"] = (
                                df_tmp_no_ts.shift(1, axis=0).rolling(s).agg(f)
                            )["pm2_5"]

                elif frequency == "hourly":
                    df_tmp.iloc[-1, df_tmp.columns.get_loc("timestamp")] = df_tmp.iloc[
                        -2, df_tmp.columns.get_loc("timestamp")
                    ] + pd.Timedelta(hours=1)

                    # lag features
                    shifts1 = [1, 2, 6, 12]
                    for s in shifts1:
                        df_tmp[f"pm2_5_last_{s}_hour"] = df_tmp.shift(s, axis=0)[
                            "pm2_5"
                        ]

                    # rolling features
                    shifts2 = [3, 6, 12, 24]
                    functions = ["mean", "std", "median", "skew"]
                    for s in shifts2:
                        for f in functions:
                            df_tmp[f"pm2_5_{f}_{s}_hour"] = (
                                df_tmp_no_ts.shift(1, axis=0).rolling(s).agg(f)
                            )["pm2_5"]

                attributes = ["year", "month", "day", "dayofweek"]
                max_vals = [2023, 12, 30, 7]
                if frequency == "hourly":
                    attributes.append("hour")
                    max_vals.append(23)
                for a, m in zip(attributes, max_vals):
                    df_tmp.tail(1)[f"{a}_sin"] = np.sin(
                        2
                        * np.pi
                        * df_tmp.tail(1)["timestamp"].dt.__getattribute__(a)
                        / m
                    )
                    df_tmp.tail(1)[f"{a}_cos"] = np.cos(
                        2
                        * np.pi
                        * df_tmp.tail(1)["timestamp"].dt.__getattribute__(a)
                        / m
                    )
                df_tmp.tail(1)["week_sin"] = np.sin(
                    2 * np.pi * df_tmp.tail(1)["timestamp"].dt.isocalendar().week / 52
                )
                df_tmp.tail(1)["week_cos"] = np.cos(
                    2 * np.pi * df_tmp.tail(1)["timestamp"].dt.isocalendar().week / 52
                )

                excluded_columns = [
                    "device_id",
                    "site_id",
                    "device_number",
                    "pm2_5",
                    "timestamp",
                    "latitude",
                    "longitude",
                    # "margin_of_error",
                    # "adjusted_forecast",
                ]
                # excluded_columns_2 = [
                #     "timestamp",
                #     "margin_of_error",
                #     "adjusted_forecast",
                # ]
                df_tmp.loc[df_tmp.index[-1], "pm2_5"] = forecast_model.predict(
                    df_tmp.drop(excluded_columns, axis=1).tail(1).values.reshape(1, -1)
                )
                # df_tmp.loc[df_tmp.index[-1], "margin_of_error"] = error_model.predict(
                #     df_tmp.drop(excluded_columns_2, axis=1)
                #     .tail(1)
                #     .values.reshape(1, -1)
                # )
                # df_tmp.loc[df_tmp.index[-1], "adjusted_forecast"] = (
                #     df_tmp.loc[df_tmp.index[-1], "pm2_5"]
                #     + df_tmp.loc[df_tmp.index[-1], "margin_of_error"]
                # )

            return df_tmp.iloc[-int(horizon) :, :]

        forecasts = pd.DataFrame()
        forecast_model = GCSUtils.get_trained_model_from_gcs(
            project_name, bucket_name, f"{frequency.str}_forecast_model.pkl"
        )
        # error_model = GCSUtils.get_trained_model_from_gcs(
        #     project_name, bucket_name, f"{frequency}_error_model.pkl"
        # )

        df_tmp = data.copy()
        for device in df_tmp["device_id"].unique():
            test_copy = df_tmp[df_tmp["device_id"] == device]
            horizon = (
                configuration.HOURLY_FORECAST_HORIZON
                if frequency.str == "hourly"
                else configuration.DAILY_FORECAST_HORIZON
            )
            device_forecasts = get_forecasts(
                test_copy,
                forecast_model,
                frequency.str,
                horizon,
            )

            forecasts = pd.concat([forecasts, device_forecasts], ignore_index=True)

        forecasts["pm2_5"] = forecasts["pm2_5"].astype(float)
        # forecasts["margin_of_error"] = forecasts["margin_of_error"].astype(float)

        return forecasts[
            [
                "site_id",
                "device_id",
                "device_number",
                "timestamp",
                "pm2_5",
                # "margin_of_error",
                # "adjusted_forecast",
            ]
        ]

    @staticmethod
    def save_forecasts_to_mongo(data: pd.DataFrame, frequency: Frequency):
        """
        Saves forecast data to a MongoDB collection based on the given frequency.

        Args:
            data (pd.DataFrame): A DataFrame containing forecast data with columns:
                - site_id(str)
                - device_id(str)
                - device_number(int)
                - pm2_5(float)
                - timestamp(datetime)
            frequency(Frequency): The forecast frequency, either "hourly" or "daily".

        Raises:
            ValueError: If an invalid frequency is provided.
        """

        if frequency.str == "hourly":
            collection = db.hourly_forecasts_1
        elif frequency.str == "daily":
            collection = db.daily_forecasts_1
        else:
            raise ValueError("Invalid frequency argument. Must be 'hourly' or 'daily'.")

        created_at = pd.Timestamp.now().isoformat()
        forecast_results: List[Dict[str, Any]] = [
            {
                "device_id": device_id,
                "device_number": group["device_number"].iloc[0],
                "created_at": created_at,
                "site_id": group["site_id"].iloc[0],
                "pm2_5": group["pm2_5"].tolist(),
                "timestamp": group["timestamp"].tolist(),
            }
            for device_id, group in data.groupby("device_id")
        ]

        for doc in forecast_results:
            try:
                filter_query = {
                    "device_id": doc["device_id"],
                    "site_id": doc["site_id"],
                }
                update_query = {
                    "$set": {
                        "pm2_5": doc["pm2_5"],
                        "timestamp": doc["timestamp"],
                        "created_at": doc["created_at"],
                    }
                }
                collection.update_one(filter_query, update_query, upsert=True)
            except Exception as e:
                logger.exception(
                    f"Failed to update forecast for device {doc['device_id']}: {e}"
                )
            except ServerSelectionTimeoutError as e:
                raise ServerSelectionTimeoutError(
                    "Could not connect to MongoDB server within timeout."
                )


class FaultDetectionUtils(BaseMlUtils):
    @staticmethod
    def flag_rule_based_faults(df: pd.DataFrame) -> pd.DataFrame:
        """
        Flags rule-based faults such as correlation and missing data
        Inputs:
            df: pandas dataframe
        Outputs:
            pandas dataframe
        """

        if not isinstance(df, pd.DataFrame):
            raise ValueError("Input must be a dataframe")

        required_columns = ["device_id", "s1_pm2_5", "s2_pm2_5"]
        if not set(required_columns).issubset(set(df.columns.to_list())):
            raise ValueError(
                f"Input must have the following columns: {required_columns}"
            )

        result = pd.DataFrame(
            columns=[
                "device_id",
                "correlation_fault",
                "correlation_value",
                "missing_data_fault",
            ]
        )
        for device in df["device_id"].unique():
            device_df = df[df["device_id"] == device]
            corr = device_df["s1_pm2_5"].corr(device_df["s2_pm2_5"])
            correlation_fault = 1 if corr < 0.9 else 0
            missing_data_fault = 0
            for col in ["s1_pm2_5", "s2_pm2_5"]:
                null_series = device_df[col].isna()
                if (null_series.rolling(window=60).sum() >= 60).any():
                    missing_data_fault = 1
                    break

            temp = pd.DataFrame(
                {
                    "device_id": [device],
                    "correlation_fault": [correlation_fault],
                    "correlation_value": [corr],
                    "missing_data_fault": [missing_data_fault],
                }
            )
            result = pd.concat([result, temp], ignore_index=True)
        result = result[
            (result["correlation_fault"] == 1) | (result["missing_data_fault"] == 1)
        ]
        return result

    @staticmethod
    def flag_pattern_based_faults(df: pd.DataFrame) -> pd.DataFrame:
        """
        Flags pattern-based faults such as high variance, constant values, etc"""
        from sklearn.ensemble import IsolationForest

        if not isinstance(df, pd.DataFrame):
            raise ValueError("Input must be a dataframe")

        df["timestamp"] = pd.to_datetime(df["timestamp"])
        columns_to_ignore = ["device_id", "timestamp"]
        df.dropna(inplace=True)

        isolation_forest = IsolationForest(contamination=0.37)
        isolation_forest.fit(df.drop(columns=columns_to_ignore))

        df["anomaly_value"] = isolation_forest.predict(
            df.drop(columns=columns_to_ignore)
        )

        return df

    @staticmethod
    def process_faulty_devices_percentage(df: pd.DataFrame):
        """Process faulty devices dataframe and save to MongoDB"""

        anomaly_percentage = pd.DataFrame(
            (
                df[df["anomaly_value"] == -1].groupby("device_id").size()
                / df.groupby("device_id").size()
            )
            * 100,
            columns=["anomaly_percentage"],
        )

        return anomaly_percentage[
            anomaly_percentage["anomaly_percentage"] > 45
        ].reset_index(level=0)

    @staticmethod
    def process_faulty_devices_fault_sequence(df: pd.DataFrame):
        df["group"] = (df["anomaly_value"] != df["anomaly_value"].shift(1)).cumsum()
        df["anomaly_sequence_length"] = (
            df[df["anomaly_value"] == -1].groupby(["device_id", "group"]).cumcount() + 1
        )
        df["anomaly_sequence_length"].fillna(0, inplace=True)
        device_max_anomaly_sequence = (
            df.groupby("device_id")["anomaly_sequence_length"].max().reset_index()
        )
        faulty_devices_df = device_max_anomaly_sequence[
            device_max_anomaly_sequence["anomaly_sequence_length"] >= 80
        ]
        faulty_devices_df.columns = ["device_id", "fault_count"]

        return faulty_devices_df

    @staticmethod
    def save_faulty_devices(*dataframes):
        """Save or update faulty devices to MongoDB"""
        dataframes = list(dataframes)
        merged_df = dataframes[0]
        for df in dataframes[1:]:
            merged_df = merged_df.merge(df, on="device_id", how="outer")
        merged_df = merged_df.fillna(0)
        merged_df["created_at"] = datetime.now().isoformat(timespec="seconds")
        with pm.MongoClient(configuration.MONGO_URI) as client:
            db = client[configuration.MONGO_DATABASE_NAME]
            records = merged_df.to_dict("records")
            bulk_ops = [
                pm.UpdateOne(
                    {"device_id": record["device_id"]},
                    {"$set": record},
                    upsert=True,
                )
                for record in records
            ]

            try:
                db.faulty_devices_1.bulk_write(bulk_ops)
            except Exception as e:
                print(f"Error saving faulty devices to MongoDB: {e}")

            print("Faulty devices saved/updated to MongoDB")


class SatelliteUtils(BaseMlUtils):
    @staticmethod
    def encode(data: pd.DataFrame, encoder: str = "LabelEncoder") -> pd.DataFrame:
        """
        applies encoding for the city and country features

        Keyword arguments:
        data --  the data frame to apply the transformation on
        encoder --  the type of encoding to apply (default: 'LabelEncoder')
        Return: returns a dataframe after applying the encoding
        """

        if "city" not in data.columns:
            raise ValueError("data frame does not contain city or country column")

        if encoder == "LabelEncoder":
            le = LabelEncoder()
            for column in ["city"]:
                data[column] = le.fit_transform(data[column])
        elif encoder == "OneHotEncoder":
            ohe = OneHotEncoder(sparse=False)
            for column in ["city"]:
                encoded_data = ohe.fit_transform(data[[column]])
                encoded_columns = [
                    f"{column}_{i}" for i in range(encoded_data.shape[1])
                ]
                encoded_df = pd.DataFrame(encoded_data, columns=encoded_columns)
                data = pd.concat([data, encoded_df], axis=1)
                data = data.drop(column, axis=1)
        else:
            raise ValueError(
                "Invalid encoder. Please choose 'LabelEncoder' or 'OneHotEncoder'."
            )

        return data

    @staticmethod
    def lag_features(
        data: pd.DataFrame, frequency: str, target_col: str
    ) -> pd.DataFrame:
        """appends lags to specific feature in the data frame.

        Keyword arguments:

            data -- the dataframe to apply the transformation on.

            frequency -- (hourly/daily) weather the lag is applied per hours or per days.

            target_col -- the column to apply the transformation on.

        Return: returns a dataframe after applying the transformation
        """
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        if frequency == "hourly":
            shifts = [1, 2, 6, 12]
            time_unit = "hour"
        elif frequency == "daily":
            shifts = [1, 2, 3, 7]
            time_unit = "day"
        else:
            raise ValueError("freq must be daily or hourly")
        for s in shifts:
            data[f"pm2_5_last_{s}_{time_unit}"] = data.groupby(["city"])[
                target_col
            ].shift(s)
        return data

    @staticmethod
    def train_satellite_model(data):
        data = data[data["pm2_5"] < 200]
        data.drop(columns=["timestamp", "city", "device_id"], inplace=True)
        model = LGBMRegressor(
            random_state=42, n_estimators=200, max_depth=10, objective="mse"
        )

        model.fit(data.drop(columns="pm2_5"), data["pm2_5"])

        # TODO: add mlflow stuff after cluster issues handled

        # n_splits = 4
        # cv = GroupKFold(n_splits=n_splits)
        # groups = data['city']
        # stds = []
        # rmse = []
        #
        # def validate(trainset, testset, t, origin):
        #     with mlflow.start_run():
        #         model.fit(data.drop(columns=t), trainset[t])
        #         pred = model.predict(np.array(testset.drop(columns=t)))
        #         origin['pm2_5'] = pred
        #         origin['date'] = pd.to_datetime(origin['date'])
        #         origin['date_day'] = origin['date'].dt.dayofyear
        #         pred = origin['date_day'].map(origin[['date_day', 'pm_5']].groupby('date_day')['pm_5'].mean())
        #         stds.append(testset[t].std())
        #         score = mean_squared_error(pred, testset[t], squared=False)
        #         mlflow.log_metric("rmse", score)
        #         mlflow.sklearn.log_model(model, "model")
        #
        # for v_train, v_test in cv.split(data, groups=groups):
        #     train_v, test_v = data.iloc[v_train], data.iloc[v_test]
        #     origin = data.iloc[v_test]
        #     rmse.append(validate(train_v, test_v, 'pm2_5', origin))

        GCSUtils.upload_trained_model_to_gcs(
            model, project_id, bucket, "satellite_prediction_model.pkl"
        )


class ForecastSiteUtils(BaseMlUtils):
    """
    Feature engineering utilities for site-level PM2.5 forecasting.
    Expects columns: site_id, day, pm25_mean
    Produces: time features, lag features, rolling stats.
    """
    @staticmethod 
    def add_time_lag_roll_features(
        df: pd.DataFrame,
        *,
        date_col: str = "day",
        site_col: str = "site_id",
        target_col: str = "pm25_mean",
        lags: Sequence[int] = (1,2,3,7,14),
        rolling_window: Sequence[int] = (7,14),
        roll_shift: int = 1,
        dropna: bool = True,
    ) -> pd.DataFrame:
        # ---- validate inputs ----
        required= {site_col, date_col, target_col}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        out = df.copy()
        out = out.sort_values([site_col, date_col])

        # Parse dates safely
        out[date_col] = pd.to_datetime(out[date_col], errors='coerce')
        if out[date_col].isna().any():
            bad = out.loc[out[date_col].isna(), [site_col, date_col]].head(5)
            raise ValueError(
                f"Some rows have invalid {date_col}. Example rows:\n{bad.to_string(index=False)}"
            )

        # Sort for correct lag/rolling behavior
        out = out.sort_values([site_col, date_col]).reset_index(drop=True)

        # ---- time features ----
        dt = out[date_col].dt
        out["day_of_week"] = dt.dayofweek
        out["day_of_year"] = dt.dayofyear
        out["month"] = dt.month
        #out["week_of_year"] = dt.isocalendar().week.astype("int16")        
        #out["is_weekend"] = dt.dayofweek >= 5

        # ---- group object once ----
        g = out.groupby(site_col, sort=False)[target_col]

        # ---- lag features ----
        for lag in lags: 
            if lag <= 0:
                raise ValueError(f"Lags must be positive, got {lag}")
            out[f"{target_col}_lag_{lag}"] = g.shift(lag)

        # ---- rolling features (per site) ----
        # Important: rolling must be applied within each group, not across all sites.
        if roll_shift <= 0:
            raise ValueError(f"roll_shift must be positive, got {roll_shift}")

        roll_windows = tuple(rolling_window)
        if not roll_windows:
            raise ValueError("rolling_window cannot be empty")

        shifted = g.shift(roll_shift)

        for w in roll_windows:
            if w <= 1:
                raise ValueError(f"Rolling windows must be greater than 1, got {w}")
            out[f"roll{w}_mean"] = shifted.transform(lambda s: s.rolling(w, min_periods=w).mean())
            out[f"roll{w}_std"]  = shifted.transform(lambda s: s.rolling(w, min_periods=w).std())
        # ---- clean up ----
        if dropna:
            feature_cols =(
                ["day_of_week", "day_of_year", "month"] +
                [f"{target_col}_lag_{lag}" for lag in lags] +
                [f"roll{w}_mean" for w in roll_windows] +
                [f"roll{w}_std" for w in roll_windows]
            )
            out = out.dropna(subset=feature_cols).reset_index(drop=True)
        return out

class ForecastModelTrainer(BaseMlUtils):
    """
    Train/evaluate and save multiple forecast models to GCS using existing GCSUtils.

    Saves each model as a single joblib artifact dict:
      {
        "kind": "mean" | "quantile",
        "model": <fitted model>,
        "features": [...],
        "target": "...",
        "date_col": "...",
        "metrics": {...},
        "params": {...},
        "alpha": 0.1/0.9 (quantile only),
      }
    """

    # -------------------------
    # helpers
    # -------------------------
    @staticmethod
    def _prep_time_split(
        df: pd.DataFrame,
        *,
        features: List[str],
        target: str,
        date_col: str,
        test_fraction: float,
        min_rows: int = 50,
    ) -> Tuple[pd.DataFrame, pd.DataFrame]:
        missing = sorted(set(features + [target, date_col]) - set(df.columns))
        if missing:
            raise ValueError(f"Missing columns: {missing}")

        work = df.copy()
        work[date_col] = pd.to_datetime(work[date_col], errors="coerce")
        work = work.dropna(subset=[date_col] + features + [target])
        work = work.sort_values(date_col).reset_index(drop=True)

        if len(work) < min_rows:
            raise ValueError(f"Not enough rows after cleaning: {len(work)} (min_rows={min_rows})")

        split_idx = int(len(work) * (1 - test_fraction))
        if split_idx <= 0 or split_idx >= len(work):
            raise ValueError("Bad test_fraction causing empty train/val split.")

        return work.iloc[:split_idx], work.iloc[split_idx:]

    @staticmethod
    def _regression_metrics(y_true, y_pred) -> Dict[str, float]:
        return {
            "mae": float(mean_absolute_error(y_true, y_pred)),
            "rmse": float(mean_squared_error(y_true, y_pred, squared=False)),
            "r2": float(r2_score(y_true, y_pred)),
        }

    @staticmethod
    def _fit_model(
        *,
        df: pd.DataFrame,
        features: List[str],
        target: str,
        date_col: str,
        test_fraction: float,
        params: Dict,
        eval_metric: str,
        early_stopping_rounds: int,
        log_period: int,
    ) -> Tuple[lgb.LGBMRegressor, Dict]:
        train_df, val_df = ForecastModelTrainer._prep_time_split(
            df, features=features, target=target, date_col=date_col, test_fraction=test_fraction
        )

        X_train, y_train = train_df[features], train_df[target]
        X_val, y_val = val_df[features], val_df[target]

        model = lgb.LGBMRegressor(**params)
        model.fit(
            X_train,
            y_train,
            eval_set=[(X_val, y_val)],
            eval_metric=eval_metric,
            callbacks=[
                lgb.early_stopping(stopping_rounds=early_stopping_rounds),
                lgb.log_evaluation(period=log_period),
            ],
        )

        preds = model.predict(X_val)
        metrics = ForecastModelTrainer._regression_metrics(y_val, preds)
        metrics.update(
            {
                "n_train": int(len(train_df)),
                "n_val": int(len(val_df)),
                "best_iteration": int(getattr(model, "best_iteration_", params.get("n_estimators", 0))),
            }
        )
        return model, metrics

    # -------------------------
    # point model (mean/min/max)
    # -------------------------
    @staticmethod
    def train_point_and_save_to_gcs(
        df: pd.DataFrame,
        *,
        features: List[str],
        target: str,  # "pm25_mean" or "pm25_min" or "pm25_max"
        model_kind: str = "point",
        date_col: str = "day",
        test_fraction: float = 0.2,
        random_state: int = 42,
        lgb_params: Optional[Dict] = None,
        # GCS
        project_name: str,
        bucket_name: str,
        blob_name: str,
        # training behavior
        early_stopping_rounds: int = 100,
        log_period: int = 200,
    ) -> Dict:
        params = {
            "n_estimators": 3000,
            "learning_rate": 0.03,
            "max_depth": 8,
            "num_leaves": 64,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "random_state": random_state,
        }
        if lgb_params:
            params.update(lgb_params)

        model, metrics = ForecastModelTrainer._fit_model(
            df=df,
            features=features,
            target=target,
            date_col=date_col,
            test_fraction=test_fraction,
            params=params,
            eval_metric="mae",
            early_stopping_rounds=early_stopping_rounds,
            log_period=log_period,
        )

        artifact = {
            "kind": model_kind,
            "model": model,
            "features": features,
            "target": target,
            "date_col": date_col,
            "metrics": metrics,
            "params": params,
        }

        GCSUtils.upload_trained_model_to_gcs(
            trained_model=artifact,
            project_name=project_name,
            bucket_name=bucket_name,
            source_blob_name=blob_name,
        )

        return metrics

    # -------------------------
    # quantile model (single alpha) on a target (usually pm25_mean)
    # -------------------------
    @staticmethod
    def train_quantile_and_save_to_gcs(
        df: pd.DataFrame,
        *,
        alpha: float,
        features: List[str],
        target: str = "pm25_mean",
        date_col: str = "day",
        test_fraction: float = 0.2,
        random_state: int = 42,
        lgb_params: Optional[Dict] = None,
        # GCS
        project_name: str,
        bucket_name: str,
        blob_name: str,
        # training behavior
        early_stopping_rounds: int = 150,
        log_period: int = 200,
    ) -> Dict:
        if not (0.0 < alpha < 1.0):
            raise ValueError(f"alpha must be between 0 and 1, got {alpha}")

        params = {
            "objective": "quantile",
            "alpha": float(alpha),
            "n_estimators": 4000,
            "learning_rate": 0.03,
            "max_depth": 8,
            "num_leaves": 64,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "random_state": random_state,
        }
        if lgb_params:
            params.update(lgb_params)

        model, metrics = ForecastModelTrainer._fit_model(
            df=df,
            features=features,
            target=target,
            date_col=date_col,
            test_fraction=test_fraction,
            params=params,
            eval_metric="quantile",
            early_stopping_rounds=early_stopping_rounds,
            log_period=log_period,
        )
        metrics["alpha"] = float(alpha)

        artifact = {
            "kind": "quantile",
            "alpha": float(alpha),
            "model": model,
            "features": features,
            "target": target,
            "date_col": date_col,
            "metrics": metrics,
            "params": params,
        }

        GCSUtils.upload_trained_model_to_gcs(
            trained_model=artifact,
            project_name=project_name,
            bucket_name=bucket_name,
            source_blob_name=blob_name,
        )

        return metrics

    # -------------------------
    # one call: save mean + min + max (+ optional bands)
    # -------------------------
    @staticmethod
    def train_and_save_all_forecast_models(
        df: pd.DataFrame,
        *,
        features: List[str],
        date_col: str = "day",
        test_fraction: float = 0.2,
        random_state: int = 42,
        # targets
        mean_target: str = "pm25_mean",
        min_target: str = "pm25_min",
        max_target: str = "pm25_max",
        # quantiles
        train_quantile_bands: bool = True,
        low_alpha: float = 0.1,
        high_alpha: float = 0.9,
        # params overrides
        lgb_params_mean: Optional[Dict] = None,
        lgb_params_min: Optional[Dict] = None,
        lgb_params_max: Optional[Dict] = None,
        lgb_params_low: Optional[Dict] = None,
        lgb_params_high: Optional[Dict] = None,
        # GCS
        project_name: str,
        bucket_name: str,
        blob_name_mean: str,      # e.g. "models/daily_pm25_mean_model.pkl"
        blob_name_min: str,       # e.g. "models/daily_pm25_min_model.pkl"
        blob_name_max: str,       # e.g. "models/daily_pm25_max_model.pkl"
        blob_name_low: str ,# "models/daily_pm25_low_model.pkl",
        blob_name_high: str, #= "models/daily_pm25_high_model.pkl",
    ) -> Dict[str, Dict]:
        out: Dict[str, Dict] = {}

        out["mean"] = ForecastModelTrainer.train_point_and_save_to_gcs(
            df,
            features=features,
            target=mean_target,
            model_kind="mean",
            date_col=date_col,
            test_fraction=test_fraction,
            random_state=random_state,
            lgb_params=lgb_params_mean,
            project_name=project_name,
            bucket_name=bucket_name,
            blob_name=blob_name_mean,
        )

        out["min"] = ForecastModelTrainer.train_point_and_save_to_gcs(
            df,
            features=features,
            target=min_target,
            model_kind="min",
            date_col=date_col,
            test_fraction=test_fraction,
            random_state=random_state,
            lgb_params=lgb_params_min,
            project_name=project_name,
            bucket_name=bucket_name,
            blob_name=blob_name_min,
        )

        out["max"] = ForecastModelTrainer.train_point_and_save_to_gcs(
            df,
            features=features,
            target=max_target,
            model_kind="max",
            date_col=date_col,
            test_fraction=test_fraction,
            random_state=random_state,
            lgb_params=lgb_params_max,
            project_name=project_name,
            bucket_name=bucket_name,
            blob_name=blob_name_max,
        )

        if train_quantile_bands:
            out["low_q"] = ForecastModelTrainer.train_quantile_and_save_to_gcs(
                df,
                alpha=low_alpha,
                features=features,
                target=mean_target,
                date_col=date_col,
                test_fraction=test_fraction,
                random_state=random_state,
                lgb_params=lgb_params_low,
                project_name=project_name,
                bucket_name=bucket_name,
                blob_name=blob_name_low,
            )
            out["high_q"] = ForecastModelTrainer.train_quantile_and_save_to_gcs(
                df,
                alpha=high_alpha,
                features=features,
                target=mean_target,
                date_col=date_col,
                test_fraction=test_fraction,
                random_state=random_state,
                lgb_params=lgb_params_high,
                project_name=project_name,
                bucket_name=bucket_name,
                blob_name=blob_name_high,
            )

        return out
