import json
import random
from datetime import datetime, timedelta

import gcsfs
import joblib
import mlflow
import numpy as np
import optuna
import pandas as pd
import pymongo as pm
from lightgbm import LGBMRegressor, early_stopping
from sklearn.metrics import mean_squared_error

from .config import configuration

project_id = configuration.GOOGLE_CLOUD_PROJECT_ID
bucket = configuration.FORECAST_MODELS_BUCKET
environment = configuration.ENVIRONMENT

pd.options.mode.chained_assignment = None


class GCSUtils:
    """Utility class for saving and retrieving models from GCS"""

    # TODO: In future, save and retrieve models from mlflow instead of GCS
    @staticmethod
    def get_trained_model_from_gcs(project_name, bucket_name, source_blob_name):
        fs = gcsfs.GCSFileSystem(project=project_name)
        fs.ls(bucket_name)
        with fs.open(bucket_name + "/" + source_blob_name, "rb") as handle:
            job = joblib.load(handle)
        return job

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

    @staticmethod
    def upload_mapping_to_gcs(
        mapping_dict, project_name, bucket_name, source_blob_name
    ):
        fs = gcsfs.GCSFileSystem(project=project_name)
        mapping_dict = json.dumps(mapping_dict)
        with fs.open(bucket_name + "/" + source_blob_name, "w") as f:
            f.write(mapping_dict)

    @staticmethod
    def get_mapping_from_gcs(project_name, bucket_name, source_blob_name):
        fs = gcsfs.GCSFileSystem(project=project_name)
        with fs.open(bucket_name + "/" + source_blob_name, "r") as f:
            mapping_dict = json.load(f)
        return mapping_dict


class DecodingUtils:
    """Utility class for encoding and decoding categorical features"""

    @staticmethod
    def decode_categorical_features_pred(df, frequency):
        columns = ["device_id", "site_id", "device_category"]
        mapping = {}
        for col in columns:
            if frequency == "hourly":
                mapping = GCSUtils.get_mapping_from_gcs(
                    project_id, bucket, f"hourly_{col}_mapping.json"
                )
            elif frequency == "daily":
                mapping = GCSUtils.get_mapping_from_gcs(
                    project_id, bucket, f"daily_{col}_mapping.json"
                )
            df[col] = df[col].map(mapping)
        return df

    @staticmethod
    def decode_categorical_features_before_save(df, frequency):
        columns = ["device_id", "site_id", "device_category"]
        mapping = {}
        for col in columns:
            if frequency == "hourly":
                mapping = GCSUtils.get_mapping_from_gcs(
                    project_id, bucket, f"hourly_{col}_mapping.json"
                )
            elif frequency == "daily":
                mapping = GCSUtils.get_mapping_from_gcs(
                    project_id, bucket, f"daily_{col}_mapping.json"
                )
            df[col] = df[col].map({v: k for k, v in mapping.items()})
        return df

    @staticmethod
    def encode_categorical_training_features(df, freq):
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df1 = df.copy()
        columns = ["device_id", "site_id", "device_category"]
        mappings = []
        for col in columns:
            mapping = {}
            for val in df1[col].unique():
                num = random.randint(0, 1000)
                while num in mapping.values():
                    num = random.randint(0, 1000)
                mapping[val] = num
            df1[col] = df1[col].map(mapping)
            mappings.append(mapping)
        for i, col in enumerate(columns):
            GCSUtils.upload_mapping_to_gcs(
                mappings[i],
                project_id,
                bucket,
                f"{freq}_{col}_mapping.json",
            )
        return df1


class ForecastUtils:
    @staticmethod
    def preprocess_data(data, data_frequency):
        required_columns = {
            "device_id",
            "site_id",
            "device_category",
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
        data["pm2_5"] = data.groupby(["device_id", "site_id", "device_category"])[
            "pm2_5"
        ].transform(lambda x: x.interpolate(method="linear", limit_direction="both"))
        if data_frequency == "daily":
            data = (
                data.groupby(["device_id", "site_id", "device_category"])
                .resample("D", on="timestamp")
                .mean(numeric_only=True)
            )
            data.reset_index(inplace=True)
            data["pm2_5"] = data.groupby(["device_id", "site_id", "device_category"])[
                "pm2_5"
            ].transform(
                lambda x: x.interpolate(method="linear", limit_direction="both")
            )
        data = data.dropna(subset=["pm2_5"])
        return data

    @staticmethod
    def get_lag_and_roll_features(df, target_col, freq):
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
        if freq == "daily":
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
        elif freq == "hourly":
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
    def get_time_and_cyclic_features(df, freq):
        if df.empty:
            raise ValueError("Empty dataframe provided")

        if "timestamp" not in df.columns:
            raise ValueError("Required columns missing")

        df["timestamp"] = pd.to_datetime(df["timestamp"])

        if freq not in ["daily", "hourly"]:
            raise ValueError("Invalid frequency")
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df1 = df.copy()
        attributes = ["year", "month", "day", "dayofweek"]
        max_vals = [2023, 12, 30, 7]
        if freq == "hourly":
            attributes.append("hour")
            max_vals.append(23)
        for a, m in zip(attributes, max_vals):
            df1[a] = df1["timestamp"].dt.__getattribute__(a)
            df1[a + "_sin"] = np.sin(2 * np.pi * df1[a] / m)
            df1[a + "_cos"] = np.cos(2 * np.pi * df1[a] / m)

        df1["week"] = df1["timestamp"].dt.isocalendar().week
        df1["week_sin"] = np.sin(2 * np.pi * df1["week"] / 52)
        df1["week_cos"] = np.cos(2 * np.pi * df1["week"] / 52)
        df1.drop(columns=attributes + ["week"], inplace=True)
        return df1

    @staticmethod
    def get_location_features(df):
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

    #     df_tmp = get_lag_features(df_tmp, target_column, data_frequency)
    #     df_tmp = get_time_and_cyclic_features(df_tmp, data_frequency)
    #     df_tmp = get_location_cord(df_tmp)
    #     if job_type == "train":
    #         df_tmp = DecodingUtils.encode_categorical_training_features(
    #             df_tmp, data_frequency
    #         )
    #     elif job_type == "predict":
    #         df_tmp = DecodingUtils.decode_categorical_features_pred(
    #             df_tmp, data_frequency
    #         )
    #         df_tmp.dropna(
    #             subset=["device_id", "site_id", "device_category"], inplace=True
    #         )  # only 1 row, not sure why
    #
    #         df_tmp["device_id"] = df_tmp["device_id"].astype(int)
    #         df_tmp["site_id"] = df_tmp["site_id"].astype(int)
    #         df_tmp["device_category"] = df_tmp["device_category"].astype(int)
    #
    #     return df_tmp

    @staticmethod
    def train_and_save_forecast_models(training_data, frequency):
        """
        Perform the actual training for hourly data
        """
        training_data.dropna(
            subset=["device_id", "site_id", "device_category"], inplace=True
        )

        training_data["device_id"] = training_data["device_id"].astype(int)
        training_data["site_id"] = training_data["site_id"].astype(int)
        training_data["device_category"] = training_data["device_category"].astype(int)

        training_data["timestamp"] = pd.to_datetime(training_data["timestamp"])
        features = [
            c
            for c in training_data.columns
            if c not in ["timestamp", "pm2_5", "latitude", "longitude"]
        ]
        print(features)
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

        train_data.drop(columns=["timestamp"], axis=1, inplace=True)
        validation_data.drop(columns=["timestamp"], axis=1, inplace=True)
        test_data.drop(columns=["timestamp"], axis=1, inplace=True)

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
                    categorical_feature=["device_id", "site_id", "device_category"],
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
                categorical_feature=["device_id", "site_id", "device_category"],
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
    def generate_forecasts(data, project_name, bucket_name, frequency):
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data.columns = data.columns.str.strip()
        # data["margin_of_error"] = data["adjusted_forecast"] = 0

        def get_forecasts(
            df_tmp,
            forecast_model,
            frequency,
            horizon,
        ):
            """This method generates forecasts for a given device dataframe basing on horizon provided"""
            for i in range(int(horizon)):
                df_tmp = pd.concat([df_tmp, df_tmp.iloc[-1:]], ignore_index=True)
                df_tmp_no_ts = df_tmp.drop("timestamp", axis=1, inplace=False)
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
            project_name, bucket_name, f"{frequency}_forecast_model.pkl"
        )
        # error_model = GCSUtils.get_trained_model_from_gcs(
        #     project_name, bucket_name, f"{frequency}_error_model.pkl"
        # )

        df_tmp = data.copy()
        for device in df_tmp["device_id"].unique():
            test_copy = df_tmp[df_tmp["device_id"] == device]
            horizon = (
                configuration.HOURLY_FORECAST_HORIZON
                if frequency == "hourly"
                else configuration.DAILY_FORECAST_HORIZON
            )
            device_forecasts = get_forecasts(
                test_copy,
                forecast_model,
                frequency,
                horizon,
            )

            forecasts = pd.concat([forecasts, device_forecasts], ignore_index=True)

        forecasts["pm2_5"] = forecasts["pm2_5"].astype(float)
        # forecasts["margin_of_error"] = forecasts["margin_of_error"].astype(float)

        DecodingUtils.decode_categorical_features_before_save(forecasts, frequency)
        forecasts = forecasts[
            [
                "device_id",
                "site_id",
                "timestamp",
                "pm2_5",
                # "margin_of_error",
                # "adjusted_forecast",
            ]
        ]
        return forecasts

    @staticmethod
    def save_forecasts_to_mongo(data, frequency):
        device_ids = data["device_id"].unique()
        created_at = pd.to_datetime(datetime.now()).isoformat()
        forecast_results = [
            {
                field: data[data["device_id"] == i][field].tolist()[0]
                if field not in ["pm2_5", "timestamp"]
                else data[data["device_id"] == i][field].tolist()
                for field in data.columns
            }
            | {"created_at": created_at}
            for i in device_ids
        ]
        client = pm.MongoClient(configuration.MONGO_URI)
        db = client[configuration.MONGO_DATABASE_NAME]
        if frequency == "hourly":
            db.hourly_forecasts.delete_many({})
            db.hourly_forecasts.insert_many(forecast_results)
            print(db.hourly_forecasts.find_one())  # confirm saving has worked
        elif frequency == "daily":
            db.daily_forecasts.delete_many({})
            db.daily_forecasts.insert_many(forecast_results)
            print(db.daily_forecasts_1.find_one())
        else:
            raise ValueError("Invalid frequency argument")
