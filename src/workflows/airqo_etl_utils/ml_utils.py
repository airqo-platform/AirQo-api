"""Utility functions and classes for ML training, forecasting, and fault detection."""

from datetime import datetime, timedelta
from typing import Dict, List, Any, Sequence, Optional, Tuple
import logging

from dateutil.relativedelta import relativedelta
from pymongo.errors import ServerSelectionTimeoutError
import mlflow
import numpy as np
import optuna
import pandas as pd
import pymongo as pm
import requests
import lightgbm as lgb
from lightgbm import LGBMRegressor, early_stopping
from sklearn.preprocessing import OneHotEncoder, LabelEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from .config import configuration, db
from .bigquery_api import BigQueryApi
from .constants import ForecastConstants, Frequency
from .date import DateUtils
from airqo_etl_utils.storage import (
    get_configured_storage,
    AWSFileStorage,
    GCSFileStorage,
    FileStorage,
)
from airqo_etl_utils.utils.machine_learning.mlflow_tracker import MlflowTracker
from airqo_etl_utils.sql import query_manager
from airqo_etl_utils.utils import Utils

logger = logging.getLogger("airflow.task")

project_id = configuration.GOOGLE_CLOUD_PROJECT_ID
bucket = configuration.FORECAST_MODELS_BUCKET
environment = configuration.ENVIRONMENT
additional_columns = ["site_id"]

pd.options.mode.chained_assignment = None

MET_NO_BASE_URL = configuration.MET_NO_BASE_URL
MET_NO_MAX_ATTEMPTS = ForecastConstants.MET_NO_MAX_ATTEMPTS
MET_NO_REQUEST_HEADERS = ForecastConstants.MET_NO_REQUEST_HEADERS
MET_NO_INSTANT_FIELDS = ForecastConstants.MET_NO_INSTANT_FIELDS
MET_NO_NEXT_1H_FIELDS = ForecastConstants.MET_NO_NEXT_1H_FIELDS
MET_NO_FORECAST_COLUMNS = ForecastConstants.MET_NO_FORECAST_COLUMNS


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
            if job_type == "predict"
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
    """Device-level PM2.5 forecast training, prediction, and persistence."""

    @staticmethod
    def train_and_save_forecast_models(training_data, frequency):
        """Train a LightGBM forecast model via Optuna hyperparameter search and save to GCS.

        Uses Optuna TPE sampler with successive halving pruner across 15 trials.
        The best hyperparameters train a final LGBMRegressor, serialized and
        uploaded to the configured GCS bucket. MLflow autologging tracks the run.

        Args:
            training_data: DataFrame with device_id, timestamp, pm2_5, and
                pre-computed feature columns.
            frequency: Model frequency label (e.g. 'hourly', 'daily') used
                for artifact naming and MLflow experiment.
        """
        filestorage: FileStorage = GCSFileStorage()
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
            logger.info(f"Best params: {best_params}")
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
            filestorage.save_file_object(
                bucket=bucket,
                obj=clf,
                destination_file=f"{frequency}_forecast_model.pkl",
            )

    @staticmethod
    def generate_forecasts(
        data: pd.DataFrame, project_name: str, bucket_name: str, frequency: Frequency
    ) -> pd.DataFrame:
        """
        Generate forecasts for the given data using a pre-trained model.
        """
        data = data.dropna(subset=["site_id", "device_id"])
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data.columns = data.columns.str.strip()

        filestorage: FileStorage = GCSFileStorage()

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
                ]
                df_tmp.loc[df_tmp.index[-1], "pm2_5"] = forecast_model.predict(
                    df_tmp.drop(excluded_columns, axis=1).tail(1).values.reshape(1, -1)
                )

            return df_tmp.iloc[-int(horizon) :, :]

        forecasts = pd.DataFrame()
        forecast_model = filestorage.load_file_object(
            bucket=bucket_name,
            source_file=f"{frequency.str}_forecast_model.pkl",
        )

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

        return forecasts[
            ["site_id", "device_id", "device_number", "timestamp", "pm2_5"]
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
            except ServerSelectionTimeoutError as e:
                raise ServerSelectionTimeoutError(
                    "Could not connect to MongoDB server within timeout."
                ) from e
            except Exception as e:
                logger.exception(
                    f"Failed to update forecast for device {doc['device_id']}: {e}"
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
        """Identify devices with long consecutive anomaly sequences.

        Groups consecutive anomaly values and returns devices whose longest
        anomaly run is >= 80 data points.

        Args:
            df: DataFrame with columns 'device_id' and 'anomaly_value'.

        Returns:
            DataFrame with 'device_id' and 'fault_count' columns for devices
            exceeding the anomaly sequence threshold.
        """
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
                logger.error(f"Error saving faulty devices to MongoDB: {e}")

            logger.info("Faulty devices saved/updated to MongoDB")


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

        filestorage: FileStorage = GCSFileStorage()
        filestorage.save_file_object(
            bucket=bucket,
            obj=model,
            destination_file="satellite_prediction_model.pkl",
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
        lags: Sequence[int] = (1, 2, 3, 7, 14),
        rolling_window: Sequence[int] = (7, 14),
        roll_shift: int = 1,
        dropna: bool = True,
    ) -> pd.DataFrame:
        """Add time-based, lag, and rolling-window features per site.

        Generates day_of_week, day_of_year, and month from the date column,
        lag features at the specified offsets, and rolling mean/std statistics.

        Args:
            df: Input DataFrame; must contain *date_col*, *site_col*, and
                *target_col*.
            date_col: Name of the date/timestamp column.
            site_col: Column identifying each site for group-wise operations.
            target_col: Column on which to compute lags and rolling stats.
            lags: Sequence of positive integers for lag features.
            rolling_window: Window sizes (>1) for rolling mean/std.
            roll_shift: Number of rows to shift before rolling (avoids leakage).
            dropna: If True, drop rows with NaN in any generated feature.

        Returns:
            DataFrame with original columns plus engineered features,
            sorted by (*site_col*, *date_col*).

        Raises:
            ValueError: On missing columns, invalid lag/window values, or
                unparseable dates.
        """
        # ---- validate inputs ----
        required = {site_col, date_col, target_col}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        out = df.copy()
        out = out.sort_values([site_col, date_col])

        # Parse dates safely
        out[date_col] = pd.to_datetime(out[date_col], errors="coerce")
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
        # out["week_of_year"] = dt.isocalendar().week.astype("int16")
        # out["is_weekend"] = dt.dayofweek >= 5

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
            out[f"roll{w}_mean"] = shifted.transform(
                lambda s: s.rolling(w, min_periods=w).mean()
            )
            out[f"roll{w}_std"] = shifted.transform(
                lambda s: s.rolling(w, min_periods=w).std()
            )
        # ---- clean up ----
        if dropna:
            feature_cols = (
                ["day_of_week", "day_of_year", "month"]
                + [f"{target_col}_lag_{lag}" for lag in lags]
                + [f"roll{w}_mean" for w in roll_windows]
                + [f"roll{w}_std" for w in roll_windows]
            )
            out = out.dropna(subset=feature_cols).reset_index(drop=True)
        return out


class ForecastModelTrainer(BaseMlUtils):
    """
    Train/evaluate and save multiple forecast models to GCS using storage adapters.

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
        """Split a DataFrame into train/test sets using a chronological cut.

        Sorts by *date_col*, drops rows with NaN in features/target, and
        splits at ``(1 - test_fraction)`` of the remaining rows.

        Args:
            df: Source DataFrame.
            features: Feature column names.
            target: Target column name.
            date_col: Date column used for sorting.
            test_fraction: Fraction of rows to use for the test set.
            min_rows: Minimum rows required after cleaning.

        Returns:
            Tuple of (train_df, test_df).

        Raises:
            ValueError: If required columns are missing or too few rows remain.
        """
        missing = sorted(set(features + [target, date_col]) - set(df.columns))
        if missing:
            raise ValueError(f"Missing columns: {missing}")

        work = df.copy()
        work[date_col] = pd.to_datetime(work[date_col], errors="coerce")
        work = work.dropna(subset=[date_col] + features + [target])
        work = work.sort_values(date_col).reset_index(drop=True)

        if len(work) < min_rows:
            raise ValueError(
                f"Not enough rows after cleaning: {len(work)} (min_rows={min_rows})"
            )

        split_idx = int(len(work) * (1 - test_fraction))
        if split_idx <= 0 or split_idx >= len(work):
            raise ValueError("Bad test_fraction causing empty train/val split.")

        return work.iloc[:split_idx], work.iloc[split_idx:]

    @staticmethod
    def _regression_metrics(y_true, y_pred) -> Dict[str, float]:
        """Compute MAE, RMSE, and R-squared for a set of predictions."""
        rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
        return {
            "mae": float(mean_absolute_error(y_true, y_pred)),
            "rmse": rmse,
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
        """Train a LightGBM model and return it with validation metrics.

        Performs a chronological train/test split, fits the model with
        early stopping, and computes regression metrics on the validation set.

        Returns:
            Tuple of (fitted model, metrics dict).
        """
        train_df, val_df = ForecastModelTrainer._prep_time_split(
            df,
            features=features,
            target=target,
            date_col=date_col,
            test_fraction=test_fraction,
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
                "best_iteration": int(
                    getattr(model, "best_iteration_", params.get("n_estimators", 0))
                ),
            }
        )
        return model, metrics

    # -------------------------
    # point model (mean/min/max)
    # -------------------------
    @staticmethod
    def _build_candidate_param_sets(
        base_params: Dict, lgb_params: Optional[Dict]
    ) -> List[Tuple[str, Dict]]:
        """Build a list of (label, params) candidates for model selection.

        Always includes the default parameter set. If *lgb_params* is provided
        and differs from the default, a 'tuned' candidate is also included.
        """
        default_params = dict(base_params)
        candidates: List[Tuple[str, Dict]] = [("default", default_params)]
        if lgb_params:
            tuned_params = dict(base_params)
            tuned_params.update(lgb_params)
            if tuned_params != default_params:
                candidates.append(("tuned", tuned_params))
        return candidates

    @staticmethod
    def _select_best_candidate(
        candidates: List[Tuple[str, lgb.LGBMRegressor, Dict, Dict]],
        metric_key: str = "mae",
    ) -> Tuple[str, lgb.LGBMRegressor, Dict, Dict]:
        """Select the candidate with the lowest value for *metric_key*."""
        if not candidates:
            raise ValueError("No trained candidates available for model selection.")
        return min(candidates, key=lambda x: x[2].get(metric_key, float("inf")))

    @staticmethod
    def _upload_model_artifact(bucket_name: str, artifact: Any, blob_name: str) -> None:
        """Serialize and upload a model artifact dict to GCS.

        Args:
            bucket_name: GCS bucket name.
            artifact: Python object to serialize (typically a dict with
                model, features, metrics, etc.).
            blob_name: Destination path/key in the bucket.
        """
        filestorage: FileStorage = GCSFileStorage()
        filestorage.save_file_object(
            bucket=bucket_name, obj=artifact, destination_file=blob_name
        )

    @staticmethod
    def _load_existing_artifact_metrics(
        bucket_name: str, blob_name: str
    ) -> Optional[Dict[str, float]]:
        """Load metrics from a previously deployed model artifact in GCS.

        Returns:
            The metrics dict if the artifact exists and contains one,
            otherwise None.
        """
        try:
            filestorage: FileStorage = GCSFileStorage()
            artifact = filestorage.load_file_object(
                bucket=bucket_name, source_file=blob_name
            )
            if isinstance(artifact, dict):
                metrics = artifact.get("metrics")
                if isinstance(metrics, dict):
                    return metrics
        except FileNotFoundError:
            return None
        except Exception as exc:
            logger.warning(
                f"Failed to load existing model metrics for {blob_name}: {exc}"
            )
            return None

        return None

    @staticmethod
    def _get_deployment_decision(
        new_metrics: Dict[str, float], old_metrics: Optional[Dict[str, float]]
    ) -> Tuple[bool, str]:
        """Decide whether to deploy a new model over an existing one.

        Deploys if the new model has strictly better R-squared, MAE, and RMSE,
        or if no previous metrics are available.

        Returns:
            Tuple of (should_deploy, reason_string).
        """
        if not old_metrics:
            return True, "no_previous_model_metrics"

        required = {"r2", "mae", "rmse"}
        if not required.issubset(new_metrics.keys()):
            return False, "new_model_metrics_incomplete"
        if not required.issubset(old_metrics.keys()):
            return True, "previous_model_metrics_incomplete"

        if (
            float(new_metrics["r2"]) > float(old_metrics["r2"])
            and float(new_metrics["mae"]) < float(old_metrics["mae"])
            and float(new_metrics["rmse"]) < float(old_metrics["rmse"])
        ):
            return True, "candidate_beats_best_historical"

        return False, "candidate_not_better_than_best_historical"

    @staticmethod
    def _deploy_if_better(
        *,
        bucket_name: str,
        artifact: Any,
        blob_name: str,
        new_metrics: Dict[str, float],
    ) -> Dict[str, Any]:
        """Compare new model metrics against the deployed model and upload if better.

        Args:
            bucket_name: GCS bucket name.
            artifact: Serializable model artifact dict.
            blob_name: Destination blob path in the bucket.
            new_metrics: Metrics from the newly trained model.

        Returns:
            Dict with 'deployed' (bool), 'reason', and 'old_metrics' keys.
        """
        old_metrics = ForecastModelTrainer._load_existing_artifact_metrics(
            bucket_name=bucket_name,
            blob_name=blob_name,
        )
        deploy_new, decision_reason = ForecastModelTrainer._get_deployment_decision(
            new_metrics=new_metrics,
            old_metrics=old_metrics,
        )

        if deploy_new:
            ForecastModelTrainer._upload_model_artifact(
                bucket_name=bucket_name,
                artifact=artifact,
                blob_name=blob_name,
            )
            return {
                "deployed": True,
                "reason": decision_reason,
                "old_metrics": old_metrics,
            }

        logger.info(
            f"Keeping existing model for {blob_name}; new model did not improve all metrics."
        )
        return {
            "deployed": False,
            "reason": decision_reason,
            "old_metrics": old_metrics,
        }

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
        """Train a point-estimate LightGBM model and conditionally deploy to GCS.

        Fits the model, compares metrics against any existing deployed model,
        and uploads if the new model is strictly better. Logs the run to MLflow.

        Args:
            df: Featured DataFrame.
            features: Feature column names.
            target: Target column (e.g. 'pm25_mean', 'pm25_min', 'pm25_max').
            model_kind: Label for the model type (e.g. 'mean', 'min', 'max').
            date_col: Date column for chronological splitting.
            test_fraction: Fraction of data reserved for validation.
            random_state: Random seed.
            lgb_params: Optional LightGBM parameter overrides.
            project_name: GCP project ID.
            bucket_name: GCS bucket for model storage.
            blob_name: Destination blob path.
            early_stopping_rounds: Early stopping patience.
            log_period: LightGBM log evaluation period.

        Returns:
            Dict of validation metrics with deployment decision metadata.
        """
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
        tracker = MlflowTracker(
            tracking_uri=configuration.MLFLOW_TRACKING_URI,
            registry_uri=configuration.MLFLOW_REGISTRY_URI,
            experiment_name=configuration.MLFLOW_EXPERIMENT_NAME
            or f"site_forecast_{environment}",
            model_gating_enabled=configuration.MLFLOW_ENABLE_MODEL_GATING,
            enabled=True,
        )
        input_example = df[features].dropna().head(5)
        if input_example.empty:
            input_example = None
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

        deployment = ForecastModelTrainer._deploy_if_better(
            bucket_name=bucket_name,
            artifact=artifact,
            blob_name=blob_name,
            new_metrics=metrics,
        )
        metrics["deployed"] = deployment["deployed"]
        metrics["deployment_reason"] = deployment["reason"]
        tracker.log_run(
            run_name=f"site-{model_kind}-{target}",
            params=params,
            metrics=metrics,
            tags={
                "pipeline": "site_forecast",
                "model_kind": model_kind,
                "target": target,
                "decision_reason": deployment["reason"],
            },
            deployed=deployment["deployed"],
            model=model,
            model_artifact_path="model",
            dataset=df,
            dataset_date_col=date_col,
            input_example=input_example,
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
        """Train a quantile-regression LightGBM model and conditionally deploy to GCS.

        Same workflow as :meth:`train_point_and_save_to_gcs` but optimises for
        a specific quantile (*alpha*).

        Args:
            df: Featured DataFrame.
            alpha: Quantile level (0 < alpha < 1), e.g. 0.1 for 10th percentile.
            features: Feature column names.
            target: Target column name.
            date_col: Date column for chronological splitting.
            test_fraction: Fraction of data reserved for validation.
            random_state: Random seed.
            lgb_params: Optional LightGBM parameter overrides.
            project_name: GCP project ID.
            bucket_name: GCS bucket for model storage.
            blob_name: Destination blob path.
            early_stopping_rounds: Early stopping patience.
            log_period: LightGBM log evaluation period.

        Returns:
            Dict of validation metrics with deployment decision metadata.

        Raises:
            ValueError: If *alpha* is not in (0, 1).
        """
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
        tracker = MlflowTracker(
            tracking_uri=configuration.MLFLOW_TRACKING_URI,
            registry_uri=configuration.MLFLOW_REGISTRY_URI,
            experiment_name=configuration.MLFLOW_EXPERIMENT_NAME
            or f"site_forecast_{environment}",
            model_gating_enabled=configuration.MLFLOW_ENABLE_MODEL_GATING,
            enabled=True,
        )
        input_example = df[features].dropna().head(5)
        if input_example.empty:
            input_example = None
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

        deployment = ForecastModelTrainer._deploy_if_better(
            bucket_name=bucket_name,
            artifact=artifact,
            blob_name=blob_name,
            new_metrics=metrics,
        )
        metrics["deployed"] = deployment["deployed"]
        metrics["deployment_reason"] = deployment["reason"]
        tracker.log_run(
            run_name=f"site-quantile-{target}-{alpha}",
            params=params,
            metrics=metrics,
            tags={
                "pipeline": "site_forecast",
                "model_kind": "quantile",
                "target": target,
                "alpha": str(alpha),
                "decision_reason": deployment["reason"],
            },
            deployed=deployment["deployed"],
            model=model,
            model_artifact_path="model",
            dataset=df,
            dataset_date_col=date_col,
            input_example=input_example,
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
        blob_name_mean: str,  # e.g. "models/daily_pm25_mean_model.pkl"
        blob_name_min: str,  # e.g. "models/daily_pm25_min_model.pkl"
        blob_name_max: str,  # e.g. "models/daily_pm25_max_model.pkl"
        blob_name_low: str,  # "models/daily_pm25_low_model.pkl",
        blob_name_high: str,  # = "models/daily_pm25_high_model.pkl",
    ) -> Dict[str, Dict]:
        """Train mean, min, max point models and optional quantile bands, deploying each to GCS.

        Convenience wrapper that calls :meth:`train_point_and_save_to_gcs`
        for three targets and optionally :meth:`train_quantile_and_save_to_gcs`
        for low/high quantile bands.

        Returns:
            Dict mapping model label ('mean', 'min', 'max', 'low_q', 'high_q')
            to their respective metrics dicts.
        """
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

    @staticmethod
    def fetch_site_forecast_training_data() -> pd.DataFrame:
        """Fetch site-level daily aggregates for quarterly forecast retraining.

        Uses a configurable month lookback window to keep the dataset size
        aligned with Airflow task memory/XCom limits.

        Returns:
            Raw site-level daily aggregates.

        Raises:
            ValueError: On missing configuration, invalid scope, or empty data.
        """
        storage_adapter = get_configured_storage()
        if storage_adapter is None:
            raise ValueError(
                "Storage adapter is not configured. Set GOOGLE_APPLICATION_CREDENTIALS "
                "to a valid service account JSON and ensure BigQuery dependencies are installed."
            )

        query: str = ""
        current_date = datetime.today()
        try:
            lookback_months = int(
                configuration.SITE_FORECAST_TRAINING_JOB_SCOPE_MONTHS
            )
        except (TypeError, ValueError) as exc:
            raise ValueError(
                "SITE_FORECAST_TRAINING_JOB_SCOPE_MONTHS must be a valid integer."
            ) from exc

        if lookback_months < 1:
            raise ValueError(
                "SITE_FORECAST_TRAINING_JOB_SCOPE_MONTHS must be greater than 0."
            )

        start_date = current_date - relativedelta(months=lookback_months)

        start_date_str = DateUtils.date_to_str(start_date, str_format="%Y-%m-%d")
        end_date_str = DateUtils.date_to_str(current_date, str_format="%Y-%m-%d")

        if query_manager.query_exists("consolidated_site_daily_aggregated"):
            query = query_manager.get_query("consolidated_site_daily_aggregated")

        if not configuration.BIGQUERY_ANALYTICS_TABLE:
            raise ValueError("Missing required config: BIGQUERY_ANALYTICS_TABLE.")

        query = query.format(
            consolidated_table=configuration.BIGQUERY_ANALYTICS_TABLE,
            start_date=start_date_str,
            end_date=end_date_str,
            min_hours=18,
        )

        raw_data = storage_adapter.download_query(query)

        if raw_data.empty:
            raise ValueError(
                "No site forecast training data found in the selected period."
            )

        return raw_data

    @staticmethod
    def run_site_forecast_quarterly_training() -> Dict[str, Dict]:
        """Run quarterly retraining of site-level PM2.5 forecast models.

        Pulls site-level consolidated daily data from BigQuery using the
        configured lookback window, engineers features, and trains mean +
        quantile (10th/90th) models. Each model is deployed only if it
        outperforms the existing artifact.

        Returns:
            Dict mapping model label to metrics with deployment metadata.

        Raises:
            ValueError: On missing configuration, empty data, or no features.
        """
        raw_data = ForecastModelTrainer.fetch_site_forecast_training_data()
        featured_data = ForecastModelTrainer._build_site_forecast_features(raw_data)

        excluded = {"day", "site_id", "site_name", "pm25_mean", "pm25_min", "pm25_max"}
        features = [
            col
            for col in featured_data.columns
            if col not in excluded and pd.api.types.is_numeric_dtype(featured_data[col])
        ]

        if not features:
            raise ValueError("No numeric features available for training.")

        project_name = configuration.GOOGLE_CLOUD_PROJECT_ID
        bucket_name = configuration.FORECAST_MODELS_BUCKET
        if not project_name or not bucket_name:
            raise ValueError(
                "Missing required config: GOOGLE_CLOUD_PROJECT_ID or FORECAST_MODELS_BUCKET."
            )

        results: Dict[str, Dict] = {}

        results["mean"] = ForecastModelTrainer.train_point_and_save_to_gcs(
            featured_data,
            features=features,
            target="pm25_mean",
            model_kind="mean",
            date_col="day",
            project_name=project_name,
            bucket_name=bucket_name,
            blob_name="daily_pm25_mean_model.pkl",
        )

        results["low_q10"] = ForecastModelTrainer.train_quantile_and_save_to_gcs(
            featured_data,
            alpha=0.1,
            features=features,
            target="pm25_mean",
            date_col="day",
            project_name=project_name,
            bucket_name=bucket_name,
            blob_name="daily_pm25_low_model.pkl",
        )

        results["high_q90"] = ForecastModelTrainer.train_quantile_and_save_to_gcs(
            featured_data,
            alpha=0.9,
            features=features,
            target="pm25_mean",
            date_col="day",
            project_name=project_name,
            bucket_name=bucket_name,
            blob_name="daily_pm25_high_model.pkl",
        )

        return results

    @staticmethod
    def _build_site_forecast_features(raw_data: pd.DataFrame) -> pd.DataFrame:
        """Engineer time/lag/rolling features and compactly encode site IDs.

        Args:
            raw_data: DataFrame with 'day', 'site_id', and 'pm25_mean' columns.

        Returns:
            Feature-engineered DataFrame with numeric site codes.

        Raises:
            ValueError: If feature engineering produces an empty result.
        """
        featured_data = ForecastSiteUtils.add_time_lag_roll_features(
            raw_data,
            date_col="day",
            site_col="site_id",
            target_col="pm25_mean",
            lags=(1, 2, 3, 7, 14),
            rolling_window=(7, 14),
            roll_shift=1,
            dropna=True,
        )

        if featured_data.empty:
            raise ValueError("Feature engineering produced an empty dataframe.")

        featured_data = featured_data.copy()
        featured_data["site_id_code"] = (
            featured_data["site_id"].astype("category").cat.codes
        )

        return featured_data

    @staticmethod
    def _select_numeric_training_features(featured_data: pd.DataFrame) -> List[str]:
        """Return numeric column names suitable for model training.

        Excludes date, identifier, and target columns.

        Raises:
            ValueError: If no numeric features remain.
        """
        excluded = {
            "day",
            "site_id",
            "site_name",
            "pm25_mean",
            "pm25_low",
            "pm25_min",
            "pm25_high",
            "pm25_max",
            "n_hours",
        }
        features = [
            col
            for col in featured_data.columns
            if col not in excluded and pd.api.types.is_numeric_dtype(featured_data[col])
        ]

        if not features:
            raise ValueError("No numeric features available for training.")

        return features

    @staticmethod
    def _get_model_bucket_config() -> Dict[str, str]:
        """Return project and bucket names from configuration.

        Raises:
            ValueError: If either value is missing.
        """
        project_name = configuration.GOOGLE_CLOUD_PROJECT_ID
        bucket_name = configuration.FORECAST_MODELS_BUCKET
        if not project_name or not bucket_name:
            raise ValueError(
                "Missing required config: GOOGLE_CLOUD_PROJECT_ID or FORECAST_MODELS_BUCKET."
            )
        return {"project_name": project_name, "bucket_name": bucket_name}

    @staticmethod
    def _load_site_forecast_artifacts() -> Dict[str, Dict[str, Any]]:
        """Load the deployed site forecast model artifacts from the bucket."""
        bucket_name = configuration.FORECAST_MODELS_BUCKET
        if not bucket_name:
            raise ValueError("Missing required config: FORECAST_MODELS_BUCKET.")

        filestorage: FileStorage = GCSFileStorage()
        model_blobs = {
            "pm2_5_mean": "daily_pm25_mean_model.pkl",
            "pm2_5_min": "daily_pm25_min_model.pkl",
            "pm2_5_max": "daily_pm25_max_model.pkl",
            "pm2_5_low": "daily_pm25_low_model.pkl",
            "pm2_5_high": "daily_pm25_high_model.pkl",
        }

        artifacts: Dict[str, Dict[str, Any]] = {}
        for label, blob_name in model_blobs.items():
            artifact = filestorage.load_file_object(
                bucket=bucket_name,
                source_file=blob_name,
            )
            if not isinstance(artifact, dict) or "model" not in artifact:
                raise ValueError(f"Invalid model artifact loaded from {blob_name}.")
            artifacts[label] = artifact

        return artifacts

    @staticmethod
    def _prepare_site_forecast_history(raw_data: pd.DataFrame) -> pd.DataFrame:
        """Validate and normalize site history before prediction."""
        if not isinstance(raw_data, pd.DataFrame):
            raise ValueError("raw_data must be a pandas DataFrame.")

        required = {"day", "site_id", "site_name", "pm25_mean", "pm25_min", "pm25_max"}
        missing = sorted(required - set(raw_data.columns))
        if missing:
            raise ValueError(f"Missing required columns for prediction: {missing}")

        history = raw_data.copy()
        history["day"] = pd.to_datetime(history["day"], errors="coerce").dt.normalize()
        if history["day"].isna().any():
            raise ValueError("Column 'day' contains invalid dates.")

        history["site_id"] = history["site_id"].astype(str)
        history["site_name"] = (
            history["site_name"].fillna(history["site_id"]).astype(str)
        )
        for coord_col in ("site_latitude", "site_longitude"):
            if coord_col in history.columns:
                history[coord_col] = pd.to_numeric(history[coord_col], errors="coerce")
        for col in ("pm25_mean", "pm25_min", "pm25_max"):
            if col not in history.columns:
                continue
            history[col] = pd.to_numeric(history[col], errors="coerce")

        history = history.dropna(subset=["site_id", "day", "pm25_mean"])
        history = history.sort_values(["site_id", "day"]).drop_duplicates(
            subset=["site_id", "day"], keep="last"
        )

        if history.empty:
            raise ValueError("No usable site history available for prediction.")

        return history.reset_index(drop=True)

    @staticmethod
    def _build_site_prediction_features(
        site_history: pd.DataFrame,
        next_day: pd.Timestamp,
        site_code: int,
    ) -> pd.DataFrame:
        """Build a single model-ready feature row for the next forecast day."""
        seed = site_history.copy()
        latest_row = site_history.iloc[-1]
        next_row: Dict[str, Any] = {
            "day": pd.Timestamp(next_day).normalize(),
            "site_id": latest_row["site_id"],
            "site_name": latest_row.get("site_name"),
            "pm25_mean": np.nan,
            "pm25_min": latest_row.get("pm25_min"),
            "pm25_max": latest_row.get("pm25_max"),
            "n_hours": latest_row.get("n_hours", 24),
        }
        next_row = pd.DataFrame([next_row])
        feature_source = pd.concat([seed, next_row], ignore_index=True)
        featured = ForecastSiteUtils.add_time_lag_roll_features(
            feature_source,
            date_col="day",
            site_col="site_id",
            target_col="pm25_mean",
            lags=(1, 2, 3, 7, 14),
            rolling_window=(7, 14),
            roll_shift=1,
            dropna=False,
        )
        feature_row = featured.loc[featured["day"] == pd.Timestamp(next_day).normalize()]
        if feature_row.empty:
            raise ValueError("No feature row generated for the next prediction step.")

        feature_row = feature_row.copy()
        feature_row["site_id_code"] = int(site_code)
        return feature_row.reset_index(drop=True)

    @staticmethod
    def _coerce_site_prediction_values(predictions: Dict[str, float]) -> Dict[str, float]:
        """Apply simple ordering constraints to multi-output PM2.5 forecasts."""
        mean_value = float(predictions["pm2_5_mean"])
        low_value, high_value = sorted(
            [float(predictions["pm2_5_low"]), float(predictions["pm2_5_high"])]
        )
        low_value = min(low_value, mean_value)
        high_value = max(high_value, mean_value)

        min_value = min(float(predictions["pm2_5_min"]), low_value, mean_value)
        max_value = max(float(predictions["pm2_5_max"]), high_value, mean_value)

        return {
            "pm2_5_mean": mean_value,
            "pm2_5_min": min_value,
            "pm2_5_max": max_value,
            "pm2_5_low": low_value,
            "pm2_5_high": high_value,
        }

    @staticmethod
    def generate_site_daily_forecasts(
        raw_data: pd.DataFrame,
        *,
        horizon: Optional[int] = None,
    ) -> pd.DataFrame:
        """Generate multi-day site-level PM2.5 forecasts from deployed models."""
        history = ForecastModelTrainer._prepare_site_forecast_history(raw_data)
        artifacts = ForecastModelTrainer._load_site_forecast_artifacts()

        forecast_horizon = int(
            horizon
            or configuration.DAILY_FORECAST_HORIZON
            or configuration.DAILY_FORECAST_DAYS
            or 10
        )
        if forecast_horizon <= 0:
            raise ValueError("Forecast horizon must be greater than 0.")

        site_codes = {
            site_id: index
            for index, site_id in enumerate(sorted(history["site_id"].dropna().unique()))
        }

        generated_rows: List[Dict[str, Any]] = []
        created_at = pd.Timestamp.utcnow().tz_localize(None)

        for site_id, site_history in history.groupby("site_id", sort=True):
            site_history = site_history.sort_values("day").reset_index(drop=True)
            site_name = site_history["site_name"].iloc[-1]
            site_latitude = site_history.iloc[-1].get("site_latitude")
            site_longitude = site_history.iloc[-1].get("site_longitude")
            site_code = site_codes.get(site_id, 0)
            rolling_history = site_history.copy()

            for _ in range(forecast_horizon):
                next_day = pd.Timestamp(rolling_history["day"].max()) + pd.Timedelta(days=1)
                feature_row = ForecastModelTrainer._build_site_prediction_features(
                    rolling_history,
                    next_day=next_day,
                    site_code=site_code,
                )

                model_predictions: Dict[str, float] = {}
                for label, artifact in artifacts.items():
                    feature_names = artifact.get("features") or []
                    if not feature_names:
                        raise ValueError(
                            f"Artifact for {label} is missing feature definitions."
                        )

                    prediction_frame = feature_row.reindex(columns=feature_names)
                    model = artifact["model"]
                    model_predictions[label] = float(model.predict(prediction_frame)[0])

                coerced = ForecastModelTrainer._coerce_site_prediction_values(
                    model_predictions
                )
                generated_rows.append(
                    {
                        "site_name": site_name,
                        "site_id": site_id,
                        "site_latitude": site_latitude,
                        "site_longitude": site_longitude,
                        "date": pd.Timestamp(next_day).normalize(),
                        **coerced,
                        "created_at": created_at,
                    }
                )

                rolling_history = pd.concat(
                    [
                        rolling_history,
                        pd.DataFrame(
                            [
                                {
                                    "day": pd.Timestamp(next_day).normalize(),
                                    "site_id": site_id,
                                    "site_name": site_name,
                                    "pm25_mean": coerced["pm2_5_mean"],
                                    "pm25_min": coerced["pm2_5_min"],
                                    "pm25_max": coerced["pm2_5_max"],
                                    "n_hours": 24,
                                }
                            ]
                        ),
                    ],
                    ignore_index=True,
                )

        if not generated_rows:
            raise ValueError("No site forecasts were generated.")

        forecast_df = pd.DataFrame(generated_rows)
        forecast_df["date"] = pd.to_datetime(forecast_df["date"]).dt.normalize()
        forecast_df["created_at"] = pd.to_datetime(
            forecast_df["created_at"]
        ).dt.tz_localize(None)
        forecast_df = forecast_df.sort_values(["site_id", "date"]).reset_index(drop=True)

        date_counts = forecast_df.groupby("site_id")["date"].nunique()
        valid_site_ids = date_counts[date_counts == forecast_horizon].index
        forecast_df = forecast_df[forecast_df["site_id"].isin(valid_site_ids)].copy()

        if forecast_df.empty:
            raise ValueError("No site produced a complete forecast horizon.")

        return forecast_df[
            [
                "site_name",
                "site_id",
                "site_latitude",
                "site_longitude",
                "date",
                "pm2_5_mean",
                "pm2_5_min",
                "pm2_5_max",
                "pm2_5_low",
                "pm2_5_high",
                "created_at",
            ]
        ].reset_index(drop=True)

    @staticmethod
    def _to_float_or_nan(value: Any) -> float:
        """Convert a scalar to float, falling back to NaN for invalid values."""
        try:
            if value is None:
                return np.nan
            return float(value)
        except (TypeError, ValueError):
            return np.nan

    @staticmethod
    def _fetch_met_locationforecast_daily_averages(
        latitude: float,
        longitude: float,
        *,
        target_dates: Optional[Sequence[Any]] = None,
    ) -> pd.DataFrame:
        """Fetch met.no hourly forecasts once per rounded coordinate and average by day."""
        if not MET_NO_BASE_URL:
            return pd.DataFrame(columns=["date", *MET_NO_FORECAST_COLUMNS])

        query_latitude = round(float(latitude), 2)
        query_longitude = round(float(longitude), 2)

        payload: Dict[str, Any] = {}
        last_error: Optional[Exception] = None
        for attempt in range(1, MET_NO_MAX_ATTEMPTS + 1):
            try:
                response = requests.get(
                    MET_NO_BASE_URL,
                    params={
                        "lat": f"{query_latitude:.2f}",
                        "lon": f"{query_longitude:.2f}",
                    },
                    headers=MET_NO_REQUEST_HEADERS,
                    timeout=60,
                )
                response.raise_for_status()
                payload = response.json()
                last_error = None
                break
            except (requests.RequestException, ValueError) as exc:
                last_error = exc
                logger.warning(
                    "met.no fetch failed for lat=%s lon=%s on attempt %s/%s: %s",
                    attempt,
                    MET_NO_MAX_ATTEMPTS,
                    exc,
                )

        if last_error is not None:
            logger.warning(
                "Skipping met.no enrichment for lat=%s lon=%s after %s failed attempts.",
                MET_NO_MAX_ATTEMPTS,
            )
            return pd.DataFrame(columns=["date", *MET_NO_FORECAST_COLUMNS])

        rows: List[Dict[str, Any]] = []
        for entry in payload.get("properties", {}).get("timeseries") or []:
            timestamp = pd.to_datetime(entry.get("time"), utc=True, errors="coerce")
            if pd.isna(timestamp):
                continue

            instant_details = (
                entry.get("data", {})
                .get("instant", {})
                .get("details", {})
            )
            next_1h_details = (
                entry.get("data", {})
                .get("next_1_hours", {})
                .get("details", {})
            )

            row: Dict[str, Any] = {
                "date": timestamp.normalize().tz_localize(None),
                "met_latitude": query_latitude,
                "met_longitude": query_longitude,
            }
            for field in MET_NO_INSTANT_FIELDS:
                row[f"met_{field}"] = ForecastModelTrainer._to_float_or_nan(
                    instant_details.get(field)
                )
            for field in MET_NO_NEXT_1H_FIELDS:
                row[f"met_{field}"] = ForecastModelTrainer._to_float_or_nan(
                    next_1h_details.get(field)
                )
            rows.append(row)

        if not rows:
            return pd.DataFrame(columns=["date", *MET_NO_FORECAST_COLUMNS])

        met_data = pd.DataFrame(rows)
        if target_dates:
            wanted_dates = pd.to_datetime(list(target_dates), errors="coerce")
            wanted_dates = wanted_dates[~pd.isna(wanted_dates)]
            if len(wanted_dates) > 0:
                wanted_dates = pd.DatetimeIndex(wanted_dates).tz_localize(None).normalize()
                met_data = met_data[met_data["date"].isin(wanted_dates)].copy()

        if met_data.empty:
            return pd.DataFrame(columns=["date", *MET_NO_FORECAST_COLUMNS])

        aggregated = met_data.groupby("date", as_index=False).agg(
            {
                column: "mean"
                for column in MET_NO_FORECAST_COLUMNS
                if column in met_data.columns
            }
        )
        return aggregated[["date", *MET_NO_FORECAST_COLUMNS]]

    @staticmethod
    def enrich_site_daily_forecasts_with_met_data(
        site_data: pd.DataFrame,
        forecast_data: pd.DataFrame,
    ) -> pd.DataFrame:
        """Append best-effort met.no daily averages to generated site forecasts.

        The original forecast identity fields such as ``site_name`` and the raw
        site coordinates are preserved. met.no lookups are deduplicated using
        latitude/longitude rounded to 2 decimal places to avoid over-querying.
        """
        if forecast_data.empty:
            return forecast_data

        enriched = forecast_data.copy()
        enriched["site_id"] = enriched["site_id"].astype(str)
        enriched["date"] = pd.to_datetime(enriched["date"], errors="coerce").dt.normalize()
        for column in MET_NO_FORECAST_COLUMNS:
            if column not in enriched.columns:
                enriched[column] = np.nan

        site_locations = enriched[["site_id"]].drop_duplicates().copy()
        for coord_col in ("site_latitude", "site_longitude"):
            if coord_col in enriched.columns:
                site_locations[coord_col] = pd.to_numeric(
                    enriched.groupby("site_id")[coord_col].last().reindex(
                        site_locations["site_id"]
                    ),
                    errors="coerce",
                ).to_numpy()
            else:
                site_locations[coord_col] = np.nan

        if site_data is not None and len(site_data) != 0:
            fallback_locations = site_data.copy()
        else:
            fallback_locations = pd.DataFrame(columns=["site_id", "site_latitude", "site_longitude"])

        if not fallback_locations.empty and {
            "site_latitude",
            "site_longitude",
        }.issubset(fallback_locations.columns):
            fallback_locations["site_id"] = fallback_locations["site_id"].astype(str)
            fallback_locations["site_latitude"] = pd.to_numeric(
                fallback_locations["site_latitude"], errors="coerce"
            )
            fallback_locations["site_longitude"] = pd.to_numeric(
                fallback_locations["site_longitude"], errors="coerce"
            )
            fallback_locations = fallback_locations.dropna(
                subset=["site_id", "site_latitude", "site_longitude"]
            )
            fallback_locations = fallback_locations[
                ["site_id", "site_latitude", "site_longitude"]
            ].drop_duplicates("site_id", keep="last")

            site_locations = site_locations.merge(
                fallback_locations,
                on="site_id",
                how="left",
                suffixes=("", "_fallback"),
            )
            for coord_col in ("site_latitude", "site_longitude"):
                fallback_col = f"{coord_col}_fallback"
                site_locations[coord_col] = site_locations[coord_col].fillna(
                    site_locations[fallback_col]
                )
                site_locations = site_locations.drop(columns=[fallback_col])

        site_locations["site_latitude"] = pd.to_numeric(
            site_locations["site_latitude"], errors="coerce"
        )
        site_locations["site_longitude"] = pd.to_numeric(
            site_locations["site_longitude"], errors="coerce"
        )
        site_locations = site_locations.dropna(
            subset=["site_id", "site_latitude", "site_longitude"]
        )
        if site_locations.empty:
            return enriched

        site_locations["met_latitude"] = site_locations["site_latitude"].round(2)
        site_locations["met_longitude"] = site_locations["site_longitude"].round(2)
        site_locations = site_locations[
            ["site_id", "site_latitude", "site_longitude", "met_latitude", "met_longitude"]
        ].drop_duplicates("site_id", keep="last")

        enriched = enriched.drop(
            columns=["site_latitude", "site_longitude", *MET_NO_FORECAST_COLUMNS],
            errors="ignore",
        ).merge(
            site_locations,
            on="site_id",
            how="left",
        )

        met_frames: List[pd.DataFrame] = []
        target_dates = enriched["date"].dropna().unique().tolist()
        for row in (
            site_locations[["met_latitude", "met_longitude"]]
            .drop_duplicates()
            .itertuples(index=False)
        ):
            met_frame = ForecastModelTrainer._fetch_met_locationforecast_daily_averages(
                row.met_latitude,
                row.met_longitude,
                target_dates=target_dates,
            )
            if met_frame.empty:
                continue
            met_frame["met_latitude"] = row.met_latitude
            met_frame["met_longitude"] = row.met_longitude
            met_frames.append(met_frame)

        if not met_frames:
            for column in MET_NO_FORECAST_COLUMNS:
                if column not in enriched.columns:
                    enriched[column] = np.nan
            return enriched

        met_data = pd.concat(met_frames, ignore_index=True, sort=False)
        return enriched.merge(
            met_data,
            on=["date", "met_latitude", "met_longitude"],
            how="left",
        )

    @staticmethod
    def _normalize_site_daily_forecasts(data: pd.DataFrame) -> pd.DataFrame:
        """Normalize forecast rows before persisting them."""
        if not isinstance(data, pd.DataFrame):
            data = pd.DataFrame(data)

        required = {
            "site_name",
            "site_id",
            "date",
            "pm2_5_mean",
            "pm2_5_min",
            "pm2_5_max",
            "pm2_5_low",
            "pm2_5_high",
        }
        missing = sorted(required - set(data.columns))
        if missing:
            raise ValueError(f"Missing required forecast columns: {missing}")

        normalized = data.copy()
        normalized["site_id"] = normalized["site_id"].astype(str)
        normalized["site_name"] = (
            normalized["site_name"].fillna(normalized["site_id"]).astype(str)
        )
        normalized["date"] = pd.to_datetime(normalized["date"], errors="coerce").dt.normalize()
        if normalized["date"].isna().any():
            raise ValueError("Forecast rows contain invalid dates.")

        pm_columns = (
            "pm2_5_mean",
            "pm2_5_min",
            "pm2_5_max",
            "pm2_5_low",
            "pm2_5_high",
        )
        for col in pm_columns:
            normalized[col] = pd.to_numeric(normalized[col], errors="coerce")
        for col in ("site_latitude", "site_longitude", *MET_NO_FORECAST_COLUMNS):
            if col not in normalized.columns:
                normalized[col] = np.nan
            normalized[col] = pd.to_numeric(normalized[col], errors="coerce")

        normalized.loc[:, pm_columns] = normalized.loc[:, pm_columns].round(1)
        normalized["site_latitude"] = normalized["site_latitude"].round(6)
        normalized["site_longitude"] = normalized["site_longitude"].round(6)

        if "created_at" in normalized.columns:
            normalized["created_at"] = pd.to_datetime(
                normalized["created_at"], errors="coerce"
            )
        else:
            normalized["created_at"] = pd.Timestamp.utcnow()

        normalized["created_at"] = normalized["created_at"].fillna(pd.Timestamp.utcnow())
        normalized["created_at"] = normalized["created_at"].dt.tz_localize(None)
        normalized = normalized.dropna(subset=["site_id", "date"])
        normalized = normalized.sort_values(["site_id", "date", "created_at"])
        normalized = normalized.drop_duplicates(
            subset=["site_id", "date"], keep="last"
        ).reset_index(drop=True)
        normalized = ForecastModelTrainer._limit_site_daily_forecasts_per_site(
            normalized
        )

        return normalized

    @staticmethod
    def _get_site_forecast_window_size(
        data: Optional[pd.DataFrame] = None,
    ) -> int:
        """Return the forecast window size used for rolling site forecast storage."""
        if data is not None and not data.empty and "date" in data.columns:
            date_counts = data.groupby("site_id")["date"].nunique()
            if not date_counts.empty:
                return max(int(date_counts.max()), 1)

        try:
            max_rows_per_site = int(configuration.DAILY_FORECAST_HORIZON or 10)
        except (TypeError, ValueError):
            max_rows_per_site = 10

        return max(max_rows_per_site, 1)

    @staticmethod
    def _limit_site_daily_forecasts_per_site(
        data: pd.DataFrame,
        *,
        max_rows_per_site: Optional[int] = None,
    ) -> pd.DataFrame:
        """Keep only the latest forecast rows for each site."""
        if data.empty:
            return data.copy()

        row_limit = (
            max_rows_per_site
            or ForecastModelTrainer._get_site_forecast_window_size(data)
        )
        limited = (
            data.sort_values(
                ["site_id", "date", "created_at"],
                ascending=[True, False, False],
            )
            .groupby("site_id", group_keys=False)
            .head(row_limit)
            .copy()
        )

        return limited.sort_values(["site_id", "date", "created_at"]).reset_index(
            drop=True
        )

    @staticmethod
    def _prune_site_daily_forecasts_in_mongo(
        collection,
        site_ids: Sequence[str],
        *,
        max_rows_per_site: int,
    ) -> None:
        """Remove persisted forecast rows beyond the configured per-site limit."""
        unique_site_ids = sorted(
            {str(site_id) for site_id in site_ids if site_id is not None}
        )
        for site_id in unique_site_ids:
            stale_ids = [
                document["_id"]
                for document in collection.find(
                    {"site_id": site_id},
                    {"_id": 1},
                )
                .sort([("date", -1), ("created_at", -1), ("_id", -1)])
                .skip(max_rows_per_site)
            ]
            if stale_ids:
                collection.delete_many({"_id": {"$in": stale_ids}})

    @staticmethod
    def _ensure_site_daily_bigquery_table_exists(table: str) -> None:
        """Create the BigQuery dataset/table for site daily forecasts if missing."""
        if not table:
            raise ValueError("Missing required config: DAILY_FORECAST_TABLE.")

        from google.api_core import exceptions as google_api_exceptions
        from google.cloud import bigquery

        bigquery_api = BigQueryApi()
        client = bigquery_api.client

        parts = table.split(".")
        if len(parts) != 3:
            raise ValueError(
                f"Invalid BigQuery table name '{table}'. Expected project.dataset.table."
            )

        project_name, dataset_name, _table_name = parts
        dataset_ref = f"{project_name}.{dataset_name}"

        try:
            client.get_dataset(dataset_ref)
        except google_api_exceptions.NotFound:
            client.create_dataset(bigquery.Dataset(dataset_ref))

        try:
            existing_table = client.get_table(table)
            schema_definition = Utils.load_schema("site_daily_forecasts.json")
            existing_fields = {field.name for field in existing_table.schema}
            missing_fields = [
                bigquery.SchemaField(
                    field["name"],
                    field["type"],
                    mode=field.get("mode", "NULLABLE"),
                )
                for field in schema_definition
                if field["name"] not in existing_fields
            ]
            if missing_fields:
                existing_table.schema = [*existing_table.schema, *missing_fields]
                client.update_table(existing_table, ["schema"])
            return
        except google_api_exceptions.NotFound:
            schema_definition = Utils.load_schema("site_daily_forecasts.json")
            schema = [
                bigquery.SchemaField(
                    field["name"],
                    field["type"],
                    mode=field.get("mode", "NULLABLE"),
                )
                for field in schema_definition
            ]
            client.create_table(bigquery.Table(table, schema=schema))

    @staticmethod
    def _save_site_daily_forecasts_to_bigquery(data: pd.DataFrame) -> Dict[str, Any]:
        """Persist site daily forecasts to BigQuery with dedupe and per-site pruning."""
        table = configuration.DAILY_FORECAST_TABLE
        if not table:
            raise ValueError("Missing required config: DAILY_FORECAST_TABLE.")

        normalized = ForecastModelTrainer._normalize_site_daily_forecasts(data)
        max_rows_per_site = ForecastModelTrainer._get_site_forecast_window_size(
            normalized
        )
        ForecastModelTrainer._ensure_site_daily_bigquery_table_exists(table)

        bigquery_api = BigQueryApi()
        client = bigquery_api.client
        min_date = normalized["date"].min().strftime("%Y-%m-%d")
        max_date = normalized["date"].max().strftime("%Y-%m-%d")
        site_ids = sorted(normalized["site_id"].dropna().unique())
        escaped_site_ids = ",".join(
            ["'" + site_id.replace("'", "''") + "'" for site_id in site_ids]
        )

        delete_query = f"""
        DELETE FROM `{table}`
        WHERE site_id IN ({escaped_site_ids})
          AND DATE(date) BETWEEN DATE('{min_date}') AND DATE('{max_date}')
        """
        client.query(delete_query).result()
        bigquery_api.load_data(normalized.copy(), table)
        prune_query = f"""
        DELETE FROM `{table}`
        WHERE STRUCT(site_id, date, created_at) IN (
            SELECT AS STRUCT site_id, date, created_at
            FROM (
                SELECT
                    site_id,
                    date,
                    created_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY site_id
                        ORDER BY DATE(date) DESC, created_at DESC
                    ) AS row_num
                FROM `{table}`
                WHERE site_id IN ({escaped_site_ids})
            )
            WHERE row_num > {max_rows_per_site}
        )
        """
        client.query(prune_query).result()

        return {
            "table": table,
            "records_saved": len(normalized),
            "max_rows_per_site": max_rows_per_site,
        }

    @staticmethod
    def _save_site_daily_forecasts_to_mongo(data: pd.DataFrame) -> Dict[str, Any]:
        """Persist site daily forecasts to MongoDB with replace-on-duplicate semantics."""
        if not configuration.MONGO_URI:
            raise ValueError("Missing required config: MONGO_URI.")

        collection_name = configuration.MONGO_SITE_DAILY_FORECAST_COLLECTION
        normalized = ForecastModelTrainer._normalize_site_daily_forecasts(data)
        max_rows_per_site = ForecastModelTrainer._get_site_forecast_window_size(
            normalized
        )
        site_ids = normalized["site_id"].dropna().astype(str).unique().tolist()

        with pm.MongoClient(configuration.MONGO_URI) as client:
            mongo_db = client[configuration.MONGO_DATABASE_NAME]
            collection = mongo_db[collection_name]
            collection.create_index([("site_id", 1), ("date", 1)])

            for record in normalized.to_dict("records"):
                record["date"] = pd.Timestamp(record["date"]).to_pydatetime()
                record["created_at"] = pd.Timestamp(record["created_at"]).to_pydatetime()
                collection.replace_one(
                    {
                        "site_id": record["site_id"],
                        "date": record["date"],
                    },
                    record,
                    upsert=True,
                )

            ForecastModelTrainer._prune_site_daily_forecasts_in_mongo(
                collection,
                site_ids,
                max_rows_per_site=max_rows_per_site,
            )

        return {
            "database": configuration.MONGO_DATABASE_NAME,
            "collection": collection_name,
            "records_saved": len(normalized),
            "max_rows_per_site": max_rows_per_site,
        }

    @staticmethod
    def _save_site_daily_forecasts_to_aws(data: pd.DataFrame) -> Dict[str, Any]:
        """Persist site daily forecasts to AWS S3 as a CSV snapshot."""
        bucket_name = configuration.AWS_SITE_DAILY_FORECAST_BUCKET
        if not bucket_name:
            raise ValueError("Missing required config: AWS_SITE_DAILY_FORECAST_BUCKET.")

        destination_key = configuration.AWS_SITE_DAILY_FORECAST_KEY
        normalized = ForecastModelTrainer._normalize_site_daily_forecasts(data)
        filestorage: FileStorage = AWSFileStorage()
        uri = filestorage.upload_dataframe(
            bucket=bucket_name,
            dataframe=normalized,
            destination_file=destination_key,
            format="csv",
        )

        return {
            "bucket": bucket_name,
            "key": destination_key,
            "uri": uri,
            "records_saved": len(normalized),
        }

    @staticmethod
    def save_site_daily_forecasts_best_effort(data: pd.DataFrame) -> Dict[str, Any]:
        """Save forecasts to all configured targets and succeed if any target works."""
        normalized = ForecastModelTrainer._normalize_site_daily_forecasts(data)
        writers = {
            "mongodb": ForecastModelTrainer._save_site_daily_forecasts_to_mongo,
            "aws": ForecastModelTrainer._save_site_daily_forecasts_to_aws,
            "bigquery": ForecastModelTrainer._save_site_daily_forecasts_to_bigquery,
        }

        details: Dict[str, Any] = {}
        errors: Dict[str, str] = {}
        for target, writer in writers.items():
            try:
                details[target] = writer(normalized.copy())
            except Exception as exc:
                logger.exception(
                    f"Failed to save site daily forecasts to {target}: {exc}"
                )
                errors[target] = str(exc)

        saved_to = list(details.keys())
        if not saved_to:
            raise RuntimeError(
                f"Failed to save site daily forecasts to all targets: {errors}"
            )

        return {"saved_to": saved_to, "details": details, "errors": errors}
