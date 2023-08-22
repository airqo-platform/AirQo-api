import json
import random
from datetime import datetime

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

fixed_columns = ["site_id"]
project_id = configuration.GOOGLE_CLOUD_PROJECT_ID
bucket = configuration.FORECAST_MODELS_BUCKET
environment = configuration.ENVIRONMENT


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


def upload_mapping_to_gcs(mapping_dict, project_name, bucket_name, source_blob_name):
    fs = gcsfs.GCSFileSystem(project=project_name)
    mapping_dict = json.dumps(mapping_dict)
    with fs.open(bucket_name + "/" + source_blob_name, "w") as f:
        f.write(mapping_dict)


def get_mapping_from_gcs(project_name, bucket_name, source_blob_name):
    fs = gcsfs.GCSFileSystem(project=project_name)
    with fs.open(bucket_name + "/" + source_blob_name, "r") as f:
        mapping_dict = json.load(f)
    return mapping_dict


class ForecastUtils:
    @staticmethod
    def preprocess_data(data, frequency):
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data["pm2_5"] = data.groupby(["device_id", "site_id", "device_category"])[
            "pm2_5"
        ].transform(lambda x: x.interpolate(method="linear", limit_direction="both"))
        if frequency == "daily":
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
    def feature_eng_data(data, target_column, frequency, job_type):
        def get_lag_features(df, target_col, freq):
            if freq == "daily":
                shifts = [1, 2, 3, 7, 14]
                for s in shifts:
                    df[f"pm2_5_last_{s}_day"] = df.groupby(["device_id"])[
                        target_col
                    ].shift(s)

                shifts = [2, 3, 7, 14]
                functions = ["mean", "std", "max", "min"]
                for s in shifts:
                    for f in functions:
                        df[f"pm2_5_{f}_{s}_day"] = (
                            df.groupby(["device_id"])[target_col]
                            .shift(1)
                            .rolling(s)
                            .agg(f)
                        )
            elif freq == "hourly":
                shifts = [1, 2, 6, 12]
                for s in shifts:
                    df[f"pm2_5_last_{s}_hour"] = df.groupby(["device_id"])[
                        target_col
                    ].shift(s)

                shifts = [3, 6, 12, 24]
                functions = ["mean", "std", "median", "skew"]
                for s in shifts:
                    for f in functions:
                        df[f"pm2_5_{f}_{s}_hour"] = (
                            df.groupby(["device_id"])[target_col]
                            .shift(1)
                            .rolling(s)
                            .agg(f)
                        )
            else:
                raise ValueError("Invalid frequency")

            return df

        def encode_categorical_features(df, frequency):
            columns = ["device_id", "site_id", "device_category"]
            mappings = []
            for col in columns:
                mapping = {}
                for val in df[col].unique():
                    num = random.randint(0, 10000)
                    while num in mapping.values():
                        num = random.randint(0, 10000)
                    mapping[val] = num
                df[col] = df[col].map(mapping)
                mappings.append(mapping)
            for i, col in enumerate(columns):
                upload_mapping_to_gcs(
                    mappings[i], project_id, bucket, f"{frequency}_{col}_mapping.json"
                )
            return df

        def get_time_and_cyclic_features(df, freq):
            attributes = ["year", "month", "day", "dayofweek"]
            max_vals = [2023, 12, 30, 7]
            if freq == "hourly":
                attributes.extend(["hour", "minute"])
                max_vals.append([23, 59])
            for a, m in zip(attributes, max_vals):
                df[a] = df["timestamp"].dt.__getattribute__(a)
                df[a + "_sin"] = np.sin(2 * np.pi * df[a] / m)
                df[a + "_cos"] = np.cos(2 * np.pi * df[a] / m)

            df["week"] = df["timestamp"].dt.isocalendar().week
            df["week_sin"] = np.sin(2 * np.pi * df["week"] / 52)
            df["week_cos"] = np.cos(2 * np.pi * df["week"] / 52)
            df.drop(columns=attributes + ["week"], inplace=True)
            return df

        def decode_categorical_features(df, frequency):
            columns = ["device_id", "site_id", "device_category"]
            for col in columns:
                if frequency == "hourly":
                    mapping = get_mapping_from_gcs(
                    project_id, bucket, f"hourly_{col}_mapping.json"
                )
                elif frequency == "daily":
                    mapping = get_mapping_from_gcs(
                    project_id, bucket, f"daily_{col}_mapping.json"
                )
                    
                df[col] = df[col].map(mapping)
            return df

        data["timestamp"] = pd.to_datetime(data["timestamp"])
        df_tmp = get_lag_features(data, target_column, frequency)
        df_tmp = get_time_and_cyclic_features(df_tmp, frequency)
        if job_type == "train":
            df_tmp = encode_categorical_features(df_tmp)
        elif job_type == "predict":
            df_tmp = decode_categorical_features(df_tmp)

        return df_tmp

    @staticmethod
    def train_and_save_forecast_models(train, frequency):
        """
        Perform the actual training for hourly data
        """
        train["timestamp"] = pd.to_datetime(train["timestamp"])
        features = [c for c in train.columns if c not in ["timestamp", "pm2_5"]]
        print(features)
        target_col = "pm2_5"
        train_data = validation_data = test_data = pd.DataFrame()
        for device in train["device_id"].unique():
            device_df = train[train["device_id"] == device]
            months = device_df["timestamp"].dt.month.unique()
            train_months = val_months = test_months = []
            if frequency == "hourly":
                train_months = months[:8]
                val_months = months[9]
                test_months = months[10]
            elif frequency == "daily":
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

            upload_trained_model_to_gcs(
                clf, project_id, bucket, f"{frequency}_forecast_model.pkl"
            )

        alphas = [0.025, 0.975]
        models = []
        names = [f'{frequency}_lower_quantile_model', f'{frequency}_upper_quantile_model']

        for alpha in alphas:
            clf = LGBMRegressor(
                n_estimators=best_params["n_estimators"],
                learning_rate=best_params["learning_rate"],
                colsample_bytree=best_params["colsample_bytree"],
                reg_alpha=best_params["reg_alpha"],
                reg_lambda=best_params["reg_lambda"],
                max_depth=best_params["max_depth"],
                random_state=42,
                verbosity=2,
                objective="quantile",
                alpha=alpha,
                metric="quantile",
            )
            clf.fit(
                train_data[features],
                train_target,
                eval_set=[(test_data[features], test_target)],
                categorical_feature=["device_id", "site_id", "device_category"],
            )
            models.append(clf)
        for n, m in zip(names, models):
            upload_trained_model_to_gcs(
                m, project_id, bucket, f"{n}.pkl"
            )


    @staticmethod
    def generate_forecasts(
        data, project_name, bucket_name, frequency
    ):
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data["pm2_5_lower"] = data["pm2_5_upper"] = data["margin_of_error"] = 0

        def get_new_row(
            df,
            device_id,
            forecast_model,
            lower_quantile_model,
            upper_quantile_model,
            frequency,
        ):
            last_row = df[df["device_id"] == device_id].iloc[-1]
            new_row = pd.Series(index=last_row.index, dtype="float64")
            if frequency == "hourly":
                new_row["timestamp"] = last_row["timestamp"] + pd.Timedelta(hours=1)
                new_row["device_id"] = device_id
                new_row[f"pm2_5_last_1_hour"] = last_row["pm2_5"]
                new_row[f"pm2_5_last_2_hour"] = last_row[f"pm2_5_last_{1}_hour"]
            elif frequency == "daily":
                new_row["timestamp"] = last_row["timestamp"] + pd.Timedelta(days=1)
                new_row["device_id"] = device_id
                new_row[f"pm2_5_last_1_day"] = last_row["pm2_5"]
                new_row[f"pm2_5_last_2_day"] = last_row[f"pm2_5_last_{1}_day"]
                new_row[f'f"pm2_5_last_3_day'] = last_row[f"pm2_5_last_{2}_day"]
                shifts1 = [3, 7, 14]
                for s in shifts1:
                    new_row[f"pm2_5_last_{s}_day"] = (
                        df[df["device_id"] == device_id]["pm2_5"].shift(s).iloc[-1]
                    )

                shifts2 = [3, 7, 14, 30]
                functions = ["mean", "std", "max", "min"]
                for s in shifts2:
                    for f in functions:
                        if f == "mean":
                            new_row[f"pm2_5_{f}_{s}_day"] = (
                                last_row["pm2_5"]
                                + last_row[f"pm2_5_{f}_{s}_day"] * (s - 1)
                            ) / s
                        elif f == "std":
                            new_row[f"pm2_5_{f}_{s}_day"] = (
                                np.sqrt(
                                    (
                                        last_row["pm2_5"]
                                        - last_row[f"pm2_5_mean_{s}_day"]
                                    )
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
            attributes = ["year", "month", "day", "dayofweek"]
            max_vals = [2023, 12, 31, 6, 23]
            if frequency == "hourly":
                attributes.extend(["hour", "minute"])
                max_vals.append([23, 59])
            for a, m in zip(attributes, max_vals):
                new_row[a] = new_row["timestamp"].dt.__getattribute__(a)
                new_row[a + "_sin"] = np.sin(2 * np.pi * new_row[a] / m)
                new_row[a + "_cos"] = np.cos(2 * np.pi * new_row[a] / m)
            new_row["week"] = new_row["timestamp"].dt.isocalendar().week
            new_row["week_sin"] = np.sin(2 * np.pi * new_row["week"] / 52)
            new_row["week_cos"] = np.cos(2 * np.pi * new_row["week"] / 52)
            direct_forecast = forecast_model.predict(
                new_row.drop(["timestamp", "pm2_5"]).values.reshape(1, -1)
            )[0]
            new_row["pm2_5_lower"] = lower_quantile_model.predict(
                new_row.drop(["timestamp", "pm2_5"]).values.reshape(1, -1)
            )[0]
            new_row["pm2_5_upper"] = upper_quantile_model.predict(
                new_row.drop(["timestamp", "pm2_5"]).values.reshape(1, -1)
            )[0]
            new_row["margin_of_error"] = (
                new_row["pm2_5_upper"] - new_row["pm2_5_lower"]
            ) / 2
            new_row["pm2_5"] = direct_forecast + new_row["margin_of_error"]

            return new_row

        forecasts = pd.DataFrame()
        forecast_model = get_trained_model_from_gcs(
            project_name, bucket_name, f"{frequency}_forecast_model.pkl"
        )
        lower_quantile_model = get_trained_model_from_gcs(
            project_name, bucket_name,  f"{frequency}_lower_quantile_model.pkl"
        )
        upper_quantile_model = get_trained_model_from_gcs(
            project_name, bucket_name, f"{frequency}_upper_quantile_model.pkl"
        )
        df_tmp = data.copy()
        for device in df_tmp["device_id"].unique():
            test_copy = df_tmp[df_tmp["device_id"] == device]
            horizon = (
                configuration.HOURLY_FORECAST_HORIZON
                if frequency == "hourly"
                else configuration.DAILY_FORECAST_HORIZON
            )
            for i in range(int(horizon)):
                new_row = get_new_row(
                    test_copy,
                    device,
                    forecast_model,
                    lower_quantile_model,
                    upper_quantile_model,
                    frequency,
                )
                test_copy = pd.concat(
                    [test_copy, new_row.to_frame().T], ignore_index=True
                )
            forecasts = pd.concat([forecasts, test_copy], ignore_index=True)

        forecasts["pm2_5"] = forecasts["pm2_5"].astype(float)
        forecasts["pm2_5_lower"] = forecasts["pm2_5_lower"].astype(float)
        forecasts["pm2_5_upper"] = forecasts["pm2_5_upper"].astype(float)
        forecasts["margin_of_error"] = forecasts["margin_of_error"].astype(float)
        current_time_utc = pd.Timestamp(datetime.utcnow(), tz="UTC")
        forecasts.rename(columns={"timestamp": "time"}, inplace=True)
        result = forecasts[
            [
                "timestamp",
                "pm2_5",
                "pm2_5_lower",
                "pm2_5_upper",
                "margin_of_error",
                "device_id",
                "site_id",
            ]
        ][forecasts["time"] >= current_time_utc]
        return result

    @staticmethod
    def save_forecasts_to_mongo(data, frequency):
        timestamp = pd.to_datetime(datetime.now()).isoformat()
        device_numbers = data["device_number"].unique()
        forecast_results = [
            {
                field: data[data["device_number"] == i][field].tolist()[0]
                if field != "pm2_5" and field != "time" and field != "health_tips"
                else data[data["device_number"] == i][field].tolist()
                for field in data.columns
            }
            | {"timestamp": timestamp}
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
