import os
from pathlib import Path
import numpy as np
import pandas as pd
import pickle
import io
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path)

RF_REG_MODEL = os.getenv("RF_REG_MODEL", "jobs/rf_reg_model.pkl")
LASSO_MODEL = os.getenv("LASSO_MODEL", "jobs/lasso_model.pkl")


class Regression:
    """
    The class contains functionality for computing device calibrated values .
    """

    def __init__(self, bucket=None):
        self.workflow_features = bucket is not None
        if bucket is not None:
            import joblib
            from google.cloud import storage

            client = storage.Client()
            bucket_obj = client.bucket(bucket)
            models = []
            for filename in ("default_rf.pkl", "default_lasso.pkl"):
                content = bucket_obj.blob(filename).download_as_bytes()
                model = joblib.load(io.BytesIO(content))
                if not callable(getattr(model, "predict", None)):
                    raise ValueError("Expected a prediction model in " + filename)
                models.append(model)
            self.rf_regressor, self.lasso_regressor = models
        else:
            with open(RF_REG_MODEL, "rb") as handle:
                self.rf_regressor = pickle.load(handle)
            with open(LASSO_MODEL, "rb") as handle:
                self.lasso_regressor = pickle.load(handle)

    # map_columns = {"datetime":"created_at"}
    def compute_calibrated_val(self, map_columns, df):
        # Map columns from uploaded csv
        df.rename(columns=map_columns, inplace=True)
        df = df.dropna()

        # features from datetime and PM
        df["datetime"] = pd.to_datetime(df["datetime"])
        # extract hour
        df["hour"] = df["datetime"].dt.hour

        df["avg_pm2_5"] = df[["pm2_5", "s2_pm2_5"]].mean(axis=1).round(2)
        df["avg_pm10"] = df[["pm10", "s2_pm10"]].mean(axis=1).round(2)
        df["error_pm10"] = np.abs(df["pm10"] - df["s2_pm10"])
        df["error_pm2_5"] = np.abs(df["pm2_5"] - df["s2_pm2_5"])
        df["pm2_5_pm10"] = df["avg_pm2_5"] - df["avg_pm10"]
        df["pm2_5_pm10_mod"] = df["pm2_5_pm10"] / df["avg_pm10"]
        if getattr(self, "workflow_features", False):
            # Match airqo_etl_utils.airqo_utils calibration inference.
            df["pm2_5_pm10_mod"] = df["avg_pm2_5"] / df["avg_pm10"]
        # df = df.drop(['pm2_5','s2_pm2_5','pm10','s2_pm10'], axis=1)

        df_copy = df

        df = df[
            [
                "avg_pm2_5",
                "avg_pm10",
                "temperature",
                "humidity",
                "hour",
                "error_pm2_5",
                "error_pm10",
                "pm2_5_pm10",
                "pm2_5_pm10_mod",
            ]
        ]

        calibrated_pm2_5 = self.rf_regressor.predict(df)
        calibrated_pm10 = self.lasso_regressor.predict(df)

        calibrated_data = df_copy[["avg_pm2_5", "avg_pm10", "datetime"]].copy()
        calibrated_data["calibrated_pm2_5"] = calibrated_pm2_5.round(2)
        calibrated_data["calibrated_pm10"] = calibrated_pm10.round(2)

        return calibrated_data


if __name__ == "__main__":
    calibrateInstance = Regression()
