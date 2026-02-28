"""Utility functions and classes for ML training, forecasting, and fault detection."""

from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Sequence, Optional, Tuple, Union
import logging

from dateutil.relativedelta import relativedelta
from pymongo.errors import ServerSelectionTimeoutError
import mlflow
import numpy as np
import optuna
import pandas as pd
import pymongo as pm
import lightgbm as lgb
from lightgbm import LGBMRegressor, LGBMClassifier, early_stopping
from sklearn.preprocessing import OneHotEncoder, LabelEncoder
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    precision_score,
    recall_score,
    f1_score,
)
from sklearn.model_selection import train_test_split

from .config import configuration, db
from .constants import Frequency
from .date import DateUtils
from airqo_etl_utils.storage import (
    get_configured_storage,
    GCSFileStorage,
    FileStorage,
)
from airqo_etl_utils.utils.machine_learning.mlflow_tracker import MlflowTracker
from airqo_etl_utils.sql import query_manager

logger = logging.getLogger("airflow.task")

project_id = configuration.GOOGLE_CLOUD_PROJECT_ID
bucket = configuration.FORECAST_MODELS_BUCKET
environment = configuration.ENVIRONMENT
additional_columns = ["site_id"]

pd.options.mode.chained_assignment = None


class BaseMlUtils:
    """Base Utility class for ML related tasks"""

    # TODO: need to review this, may need to make better abstractions

    @staticmethod
    def normalize_frequency(
        frequency: Union[Frequency, str], *, param_name: str = "frequency"
    ) -> Frequency:
        """Coerce a frequency enum or string to :class:`Frequency`."""
        if isinstance(frequency, Frequency):
            return frequency

        if isinstance(frequency, str):
            normalized = frequency.strip().upper()
            try:
                return Frequency[normalized]
            except KeyError as exc:
                raise ValueError(
                    f"Invalid {param_name} '{frequency}', must map to a Frequency enum."
                ) from exc

        if hasattr(frequency, "str"):
            return BaseMlUtils.normalize_frequency(
                getattr(frequency, "str"), param_name=param_name
            )

        raise ValueError(
            f"Invalid {param_name} type '{type(frequency).__name__}', expected Frequency or str."
        )

    @staticmethod
    def preprocess_data(
        data: pd.DataFrame, data_frequency: Union[Frequency, str], job_type: str
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
        data_frequency = BaseMlUtils.normalize_frequency(
            data_frequency, param_name="data_frequency"
        )

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
        df: pd.DataFrame, target_col: str, freq: Union[Frequency, str]
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
        freq = BaseMlUtils.normalize_frequency(freq)

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
    def get_time_features(
        df: pd.DataFrame, freq: Union[Frequency, str]
    ) -> pd.DataFrame:
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
        freq = BaseMlUtils.normalize_frequency(freq)

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
    def get_cyclic_features(df: pd.DataFrame, freq: Union[Frequency, str]):
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
        freq = BaseMlUtils.normalize_frequency(freq)
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
    DEFAULT_FAULT_MODEL_PATH = "fault_detection_model.pkl"
    MIN_TRAINING_ROWS = 200

    @staticmethod
    def _validate_fault_input(df: pd.DataFrame) -> pd.DataFrame:
        """Validate and standardize raw fault-detection input."""
        if not isinstance(df, pd.DataFrame):
            raise ValueError("Input must be a dataframe")

        required_columns = ["device_id", "timestamp", "s1_pm2_5", "s2_pm2_5"]
        missing_columns = set(required_columns).difference(df.columns.to_list())
        if missing_columns:
            raise ValueError(
                f"Input must have the following columns: {required_columns}"
            )

        validated = df.copy()
        validated["timestamp"] = pd.to_datetime(validated["timestamp"], utc=True)
        for column in ["s1_pm2_5", "s2_pm2_5", "battery"]:
            if column in validated.columns:
                validated[column] = pd.to_numeric(validated[column], errors="coerce")

        if "battery" not in validated.columns:
            validated["battery"] = np.nan

        validated.sort_values(["device_id", "timestamp"], inplace=True)
        validated.reset_index(drop=True, inplace=True)
        return validated

    @staticmethod
    def prepare_fault_features(df: pd.DataFrame) -> pd.DataFrame:
        """Build row-level features and rule flags for fault detection."""
        featured = FaultDetectionUtils._validate_fault_input(df)
        device_group = featured.groupby("device_id", sort=False)

        featured["sensor_mean"] = featured[["s1_pm2_5", "s2_pm2_5"]].mean(axis=1)
        featured["sensor_abs_diff"] = (
            featured["s1_pm2_5"] - featured["s2_pm2_5"]
        ).abs()
        featured["sensor_rel_diff"] = featured["sensor_abs_diff"] / (
            featured["sensor_mean"].abs() + 1
        )
        featured["hour"] = featured["timestamp"].dt.hour
        featured["day_of_week"] = featured["timestamp"].dt.dayofweek

        featured["pm25_rate_change"] = device_group["sensor_mean"].diff().abs()
        rolling_mean = (
            device_group["sensor_mean"]
            .transform(lambda series: series.shift(1).rolling(6, min_periods=2).mean())
        )
        rolling_std = (
            device_group["sensor_mean"]
            .transform(lambda series: series.shift(1).rolling(6, min_periods=2).std())
        )
        rolling_min = (
            device_group["sensor_mean"]
            .transform(lambda series: series.shift(1).rolling(6, min_periods=2).min())
        )
        rolling_max = (
            device_group["sensor_mean"]
            .transform(lambda series: series.shift(1).rolling(6, min_periods=2).max())
        )
        rolling_diff_mean = (
            device_group["sensor_abs_diff"]
            .transform(lambda series: series.shift(1).rolling(6, min_periods=2).mean())
        )

        featured["rolling_mean_6"] = rolling_mean
        featured["rolling_std_6"] = rolling_std.fillna(0)
        featured["rolling_min_6"] = rolling_min
        featured["rolling_max_6"] = rolling_max
        featured["rolling_abs_diff_6"] = rolling_diff_mean.fillna(0)
        sensor_corr_series = []
        for _, device_df in featured.groupby("device_id", sort=False):
            sensor_corr_series.append(
                device_df["s1_pm2_5"]
                .rolling(24, min_periods=6)
                .corr(device_df["s2_pm2_5"])
            )
        featured["sensor_corr_24"] = pd.concat(sensor_corr_series).sort_index()

        featured["missing_data_fault"] = featured[
            ["s1_pm2_5", "s2_pm2_5"]
        ].isna().any(axis=1).astype(int)
        featured["negative_value_fault"] = (
            featured[["s1_pm2_5", "s2_pm2_5"]] < 0
        ).any(axis=1).astype(int)
        featured["out_of_range_fault"] = (
            featured[["s1_pm2_5", "s2_pm2_5"]] > 1000
        ).any(axis=1).astype(int)
        featured["sensor_divergence_fault"] = (
            (featured["sensor_abs_diff"] > 35) | (featured["sensor_rel_diff"] > 0.6)
        ).astype(int)
        featured["correlation_fault"] = (
            featured["sensor_corr_24"].fillna(1) < 0.75
        ).astype(int)
        featured["battery_low_fault"] = (
            featured["battery"].fillna(5) < 3.3
        ).astype(int)

        sensor_mean_filled = featured["sensor_mean"].ffill()
        same_as_previous = (
            sensor_mean_filled.eq(sensor_mean_filled.groupby(featured["device_id"]).shift())
        )
        featured["flatline_streak"] = (
            same_as_previous.groupby(
                [featured["device_id"], (~same_as_previous).cumsum()]
            ).cumcount()
            + 1
        )
        featured.loc[~same_as_previous, "flatline_streak"] = 0
        featured["stuck_value_fault"] = (featured["flatline_streak"] >= 6).astype(int)

        std_guard = featured["rolling_std_6"].replace(0, np.nan)
        spike_mask = (
            (featured["pm25_rate_change"] > (3 * std_guard))
            | (featured["pm25_rate_change"] > 80)
        )
        featured["spike_fault"] = spike_mask.fillna(False).astype(int)

        missing_run = device_group["missing_data_fault"].transform(
            lambda series: series.rolling(6, min_periods=1).sum()
        )
        featured["missing_streak_fault"] = (missing_run >= 6).astype(int)

        fault_columns = FaultDetectionUtils.get_rule_fault_columns()
        featured["rule_fault_score"] = featured[fault_columns].sum(axis=1)
        featured["rule_based_fault"] = (featured["rule_fault_score"] > 0).astype(int)

        featured.replace([np.inf, -np.inf], np.nan, inplace=True)
        return featured

    @staticmethod
    def get_rule_fault_columns() -> List[str]:
        return [
            "correlation_fault",
            "missing_data_fault",
            "negative_value_fault",
            "out_of_range_fault",
            "sensor_divergence_fault",
            "battery_low_fault",
            "stuck_value_fault",
            "spike_fault",
            "missing_streak_fault",
        ]

    @staticmethod
    def get_fault_feature_columns(featured_df: pd.DataFrame) -> List[str]:
        excluded = {
            "device_id",
            "timestamp",
            "anomaly_value",
            "ml_fault",
            "ml_fault_probability",
            "weak_fault_label",
            "rule_based_fault",
        }
        return [
            column
            for column in featured_df.columns
            if column not in excluded
            and pd.api.types.is_numeric_dtype(featured_df[column])
        ]

    @staticmethod
    def prepare_fault_model_matrix(featured_df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
        """Return a feature-complete dataframe for anomaly scoring or model training."""
        prepared = featured_df.copy()
        feature_columns = FaultDetectionUtils.get_fault_feature_columns(prepared)
        prepared[feature_columns] = prepared[feature_columns].replace(
            [np.inf, -np.inf], np.nan
        )
        prepared[feature_columns] = prepared.groupby("device_id")[feature_columns].transform(
            lambda frame: frame.ffill().bfill()
        )
        prepared[feature_columns] = prepared[feature_columns].fillna(0)
        return prepared, feature_columns

    @staticmethod
    def _load_existing_artifact_metrics(
        *, bucket_name: str, blob_name: str
    ) -> Optional[Dict[str, float]]:
        """Load metrics from a previously deployed fault model artifact."""
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
                f"Failed to load existing fault model metrics for {blob_name}: {exc}"
            )
            return None

        return None

    @staticmethod
    def _get_deployment_decision(
        new_metrics: Dict[str, float], old_metrics: Optional[Dict[str, float]]
    ) -> Tuple[bool, str]:
        """Deploy only when the candidate meaningfully improves classification quality."""
        if not old_metrics:
            return True, "no_previous_model_metrics"

        required = {"f1_score", "precision", "recall"}
        if not required.issubset(new_metrics.keys()):
            return False, "new_model_metrics_incomplete"
        if not required.issubset(old_metrics.keys()):
            return True, "previous_model_metrics_incomplete"

        if (
            float(new_metrics["f1_score"]) > float(old_metrics["f1_score"])
            and float(new_metrics["precision"]) >= float(old_metrics["precision"])
            and float(new_metrics["recall"]) >= float(old_metrics["recall"])
        ):
            return True, "candidate_beats_best_historical"

        return False, "candidate_not_better_than_best_historical"

    @staticmethod
    def _deploy_if_better(
        *,
        bucket_name: str,
        artifact: Dict[str, Any],
        blob_name: str,
        new_metrics: Dict[str, float],
    ) -> Dict[str, Any]:
        """Upload the fault model artifact only if it outperforms the deployed one."""
        old_metrics = FaultDetectionUtils._load_existing_artifact_metrics(
            bucket_name=bucket_name,
            blob_name=blob_name,
        )
        deploy_new, decision_reason = FaultDetectionUtils._get_deployment_decision(
            new_metrics=new_metrics,
            old_metrics=old_metrics,
        )

        if deploy_new:
            filestorage: FileStorage = GCSFileStorage()
            filestorage.save_file_object(
                bucket=bucket_name,
                obj=artifact,
                destination_file=blob_name,
            )
            return {
                "deployed": True,
                "reason": decision_reason,
                "old_metrics": old_metrics,
            }

        logger.info(
            f"Keeping existing fault model for {blob_name}; candidate did not improve deployment metrics."
        )
        return {
            "deployed": False,
            "reason": decision_reason,
            "old_metrics": old_metrics,
        }

    @staticmethod
    def summarize_rule_faults(featured_df: pd.DataFrame) -> pd.DataFrame:
        """Aggregate rule-based row faults to device-level weekly summaries."""
        fault_columns = FaultDetectionUtils.get_rule_fault_columns()
        summary = (
            featured_df.groupby("device_id")[fault_columns + ["rule_fault_score"]]
            .max()
            .reset_index()
        )
        summary["rule_fault_rows"] = (
            featured_df.groupby("device_id")["rule_based_fault"].sum().values
        )
        summary["fault_severity"] = (
            featured_df.groupby("device_id")["rule_fault_score"].max().values
        )
        summary["fault_types"] = summary[fault_columns].apply(
            lambda row: ",".join([column for column, value in row.items() if value > 0]),
            axis=1,
        )
        return summary[
            (summary[fault_columns].sum(axis=1) > 0) | (summary["rule_fault_rows"] > 0)
        ]

    @staticmethod
    def flag_rule_based_faults(df: pd.DataFrame) -> pd.DataFrame:
        """
        Flags rule-based faults such as correlation and missing data
        Inputs:
            df: pandas dataframe
        Outputs:
            pandas dataframe
        """
        featured = FaultDetectionUtils.prepare_fault_features(df)
        return FaultDetectionUtils.summarize_rule_faults(featured)

    @staticmethod
    def flag_pattern_based_faults(df: pd.DataFrame) -> pd.DataFrame:
        """
        Flags pattern-based faults such as high variance, constant values, etc"""
        from sklearn.ensemble import IsolationForest

        if not isinstance(df, pd.DataFrame):
            raise ValueError("Input must be a dataframe")

        prepared = FaultDetectionUtils.prepare_fault_features(df)
        scoring_df, feature_columns = FaultDetectionUtils.prepare_fault_model_matrix(
            prepared
        )
        if scoring_df.empty:
            raise ValueError("No fault features available for anomaly detection")

        isolation_forest = IsolationForest(contamination=0.37)
        isolation_forest.fit(scoring_df[feature_columns])

        scoring_df["anomaly_value"] = isolation_forest.predict(scoring_df[feature_columns])

        return scoring_df

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
    def train_fault_detection_model(
        df: pd.DataFrame,
        *,
        min_rows: Optional[int] = None,
        model_path: Optional[str] = None,
        bucket_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Train and persist a weekly fault-classification model."""
        featured = FaultDetectionUtils.prepare_fault_features(df)
        anomaly_scored = FaultDetectionUtils.flag_pattern_based_faults(df)
        weak_labels = anomaly_scored[["device_id", "timestamp", "anomaly_value"]].copy()
        weak_labels["weak_fault_label"] = (
            weak_labels["anomaly_value"].eq(-1).astype(int)
        )
        training_df = featured.merge(
            weak_labels[["device_id", "timestamp", "weak_fault_label"]],
            on=["device_id", "timestamp"],
            how="left",
        )
        training_df["weak_fault_label"] = training_df["weak_fault_label"].fillna(0)
        training_df["weak_fault_label"] = (
            (training_df["rule_based_fault"] == 1)
            | (training_df["weak_fault_label"] == 1)
        ).astype(int)

        min_rows = min_rows or FaultDetectionUtils.MIN_TRAINING_ROWS
        if len(training_df) < min_rows:
            raise ValueError(
                f"Insufficient data for training fault model. Need at least {min_rows} rows."
            )

        model_df, feature_columns = FaultDetectionUtils.prepare_fault_model_matrix(
            training_df
        )
        labels = model_df["weak_fault_label"]
        if labels.nunique() < 2:
            raise ValueError(
                "Fault model training requires both faulty and non-faulty samples."
            )
        if (labels.value_counts() < 2).any():
            raise ValueError(
                "Fault model training requires at least two samples in each class "
                "for holdout evaluation."
            )

        classifier_params = {
            "objective": "binary",
            "n_estimators": 250,
            "learning_rate": 0.05,
            "num_leaves": 31,
            "random_state": 42,
            "class_weight": "balanced",
            "verbosity": -1,
        }
        validation_rows = max(2, int(round(len(model_df) * 0.2)))
        validation_rows = min(validation_rows, len(model_df) - 2)

        (
            training_features,
            validation_features,
            training_labels,
            validation_labels,
        ) = train_test_split(
            model_df[feature_columns],
            labels,
            test_size=validation_rows,
            random_state=42,
            stratify=labels,
        )

        evaluation_classifier = LGBMClassifier(
            **classifier_params,
        )
        evaluation_classifier.fit(training_features, training_labels)

        predictions = evaluation_classifier.predict(validation_features)
        probabilities = evaluation_classifier.predict_proba(validation_features)[:, 1]
        metrics = {
            "precision": float(
                precision_score(validation_labels, predictions, zero_division=0)
            ),
            "recall": float(
                recall_score(validation_labels, predictions, zero_division=0)
            ),
            "f1_score": float(f1_score(validation_labels, predictions, zero_division=0)),
            "positive_rate": float(validation_labels.mean()),
            "mean_probability": float(probabilities.mean()),
            "rows_used": int(len(validation_labels)),
        }

        classifier = LGBMClassifier(**classifier_params)
        classifier.fit(model_df[feature_columns], labels)
        artifact = {
            "model": classifier,
            "feature_columns": feature_columns,
            "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "metrics": metrics,
        }
        target_bucket = bucket_name or bucket
        target_path = model_path or FaultDetectionUtils.DEFAULT_FAULT_MODEL_PATH

        deployment = FaultDetectionUtils._deploy_if_better(
            bucket_name=target_bucket,
            artifact=artifact,
            blob_name=target_path,
            new_metrics=metrics,
        )
        metrics["deployed"] = deployment["deployed"]
        metrics["deployment_reason"] = deployment["reason"]

        tracker = MlflowTracker(
            tracking_uri=configuration.MLFLOW_TRACKING_URI,
            registry_uri=configuration.MLFLOW_REGISTRY_URI,
            experiment_name=configuration.MLFLOW_FAULT_NAME
            or f"fault_detection_{environment}",
            model_gating_enabled=configuration.MLFLOW_ENABLE_MODEL_GATING,
            enabled=True,
        )
        input_example = model_df[feature_columns].head(5)
        if input_example.empty:
            input_example = None
        tracker.log_run(
            run_name="fault-detection-weekly-training",
            params={
                "model_type": "LGBMClassifier",
                "n_estimators": 250,
                "learning_rate": 0.05,
                "num_leaves": 31,
                "min_rows": min_rows,
                "feature_count": len(feature_columns),
                "model_path": target_path,
            },
            metrics=metrics,
            tags={
                "pipeline": "fault_detection",
                "model_kind": "classification",
                "decision_reason": deployment["reason"],
                "deployed": str(deployment["deployed"]).lower(),
                "bucket_name": target_bucket,
            },
            model=classifier,
            model_artifact_path="model",
            input_example=input_example,
        )

        return metrics

    @staticmethod
    def flag_ml_based_faults(
        df: pd.DataFrame, *, model_path: Optional[str] = None
    ) -> pd.DataFrame:
        """Apply the persisted fault-classification model to raw readings."""
        featured = FaultDetectionUtils.prepare_fault_features(df)
        filestorage: FileStorage = GCSFileStorage()
        resolved_model_path = model_path or FaultDetectionUtils.DEFAULT_FAULT_MODEL_PATH
        try:
            artifact = filestorage.load_file_object(
                bucket=bucket,
                source_file=resolved_model_path,
            )
        except FileNotFoundError:
            logger.warning(
                "Fault detection model not found at "
                f"{bucket}/{resolved_model_path}. Skipping ML-based fault scoring."
            )
            return pd.DataFrame(
                columns=["device_id", "ml_fault_probability", "ml_fault"]
            )
        feature_columns = artifact["feature_columns"]

        for column in feature_columns:
            if column not in featured.columns:
                featured[column] = 0.0

        inference_df, _ = FaultDetectionUtils.prepare_fault_model_matrix(featured)
        if inference_df.empty:
            return pd.DataFrame(
                columns=["device_id", "ml_fault_probability", "ml_fault"]
            )

        model = artifact["model"]
        inference_df["ml_fault_probability"] = model.predict_proba(
            inference_df[feature_columns]
        )[:, 1]
        inference_df["ml_fault"] = (
            inference_df["ml_fault_probability"] >= 0.6
        ).astype(int)

        summary = (
            inference_df.groupby("device_id")
            .agg(
                ml_fault_probability=("ml_fault_probability", "max"),
                ml_fault=("ml_fault", "max"),
            )
            .reset_index()
        )
        return summary[summary["ml_fault"] == 1]

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

    @staticmethod
    def run_weekly_fault_detection() -> Dict[str, pd.DataFrame]:
        """Run the weekly fault-detection workflow from raw readings."""
        from airqo_etl_utils.bigquery_api import BigQueryApi

        raw_data = BigQueryApi().fetch_raw_readings()
        rule_based_faults = FaultDetectionUtils.flag_rule_based_faults(raw_data)
        pattern_based_faults = FaultDetectionUtils.flag_pattern_based_faults(raw_data)
        faulty_devices_percentage = FaultDetectionUtils.process_faulty_devices_percentage(
            pattern_based_faults.copy()
        )
        faulty_devices_sequence = (
            FaultDetectionUtils.process_faulty_devices_fault_sequence(
                pattern_based_faults.copy()
            )
        )
        ml_faults = FaultDetectionUtils.flag_ml_based_faults(raw_data)
        FaultDetectionUtils.save_faulty_devices(
            rule_based_faults,
            faulty_devices_percentage,
            faulty_devices_sequence,
            ml_faults,
        )
        return {
            "rule_based_faults": rule_based_faults,
            "pattern_based_faults": pattern_based_faults,
            "faulty_devices_percentage": faulty_devices_percentage,
            "faulty_devices_sequence": faulty_devices_sequence,
            "ml_faults": ml_faults,
        }

    @staticmethod
    def run_weekly_fault_model_training() -> Dict[str, Any]:
        """Fetch weekly raw readings and retrain the fault model."""
        from airqo_etl_utils.bigquery_api import BigQueryApi

        raw_data = BigQueryApi().fetch_raw_readings()
        return FaultDetectionUtils.train_fault_detection_model(raw_data)


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
                "deployed": str(deployment["deployed"]).lower(),
            },
            model=model,
            model_artifact_path="model",
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
                "deployed": str(deployment["deployed"]).lower(),
            },
            model=model,
            model_artifact_path="model",
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
    def run_site_forecast_quarterly_training() -> Dict[str, Dict]:
        """Run quarterly retraining of site-level PM2.5 forecast models.

        Pulls 90 months of consolidated daily site data from BigQuery,
        engineers features, and trains mean + quantile (10th/90th) models.
        Each model is deployed only if it outperforms the existing artifact.

        Returns:
            Dict mapping model label to metrics with deployment metadata.

        Raises:
            ValueError: On missing configuration, empty data, or no features.
        """
        storage_adapter = get_configured_storage()
        if storage_adapter is None:
            raise ValueError(
                "Storage adapter is not configured. Set GOOGLE_APPLICATION_CREDENTIALS "
                "to a valid service account JSON and ensure BigQuery dependencies are installed."
            )

        query: str = ""
        current_date = datetime.today()
        start_date = current_date - relativedelta(months=90)

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
        """Engineer time/lag/rolling features and one-hot-encode site IDs.

        Args:
            raw_data: DataFrame with 'day', 'site_id', and 'pm25_mean' columns.

        Returns:
            Feature-engineered DataFrame with site dummy columns.

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
        featured_data = pd.get_dummies(
            featured_data,
            columns=["site_id"],
            prefix="site",
            dtype="int64",
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
            "pm25_min",
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
