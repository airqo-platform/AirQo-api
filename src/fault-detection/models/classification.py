import os
import pickle

import numpy as np
import pandas as pd
from dotenv import find_dotenv
from dotenv import load_dotenv
from keras.models import load_model

load_dotenv(find_dotenv())

CATBOOST_MODEL = os.getenv("CATBOOST_MODEL", "jobs/catboost_model.pkl")
LSTM_MODEL = os.getenv("LSTM_MODEL", "jobs/lstm_model.h5")
SCALER = os.getenv("SCALER", "jobs/scaler.pkl")


class Classification:
    @staticmethod
    def predict_faults_catboost(model_inputs):

        map_columns = {
            "datetime": "Datetime",
            "s1_pm2.5": "Sensor1_PM2.5",
            "s2_pm2.5": "Sensor2_PM2.5",
            "device_id": "Device_ID",
        }

        model_inputs = pd.DataFrame(model_inputs)
        model_inputs.rename(columns=map_columns, inplace=True)

        model_inputs["Datetime"] = pd.to_datetime(model_inputs.Datetime)
        model_inputs["Datetime_day"] = model_inputs.Datetime.dt.day
        model_inputs["Datetime_month"] = model_inputs.Datetime.dt.month
        model_inputs["Datetime_hour"] = model_inputs.Datetime.dt.hour

        model_inputs["Sensor difference"] = (
            model_inputs["Sensor1_PM2.5"] - model_inputs["Sensor2_PM2.5"]
        ).abs()
        model_inputs["Sensor div"] = (
            model_inputs["Sensor1_PM2.5"] / model_inputs["Sensor2_PM2.5"]
        ).abs()
        model_inputs["Mean"] = model_inputs[["Sensor1_PM2.5", "Sensor2_PM2.5"]].mean(
            axis=1
        )
        model_inputs["Var"] = model_inputs[["Sensor1_PM2.5", "Sensor2_PM2.5"]].var(
            axis=1
        )

        classifier = pickle.load(open(CATBOOST_MODEL, "rb"))
        predicted_faults = classifier.predict(model_inputs.drop("Device_ID", axis=1))
        faults_df = pd.DataFrame(
            predicted_faults,
            columns=[
                "Offset_fault",
                "Out_of_bounds_fault",
                "Data_loss_fault",
                "High_variance_fault",
            ],
        )

        model_output = model_inputs[
            ["Datetime", "Device_ID", "Sensor1_PM2.5", "Sensor2_PM2.5"]
        ].join(faults_df)
        model_output["Datetime"] = model_output["Datetime"].apply(
            lambda x: x.isoformat()
        )  # Convert to ISO format

        model_output.rename(
            columns={
                "Datetime": "datetime",
                "Device_ID": "device_id",
                "Sensor1_PM2.5": "s1_pm2.5",
                "Sensor2_PM2.5": "s2_pm2.5",
                "Offset_fault": "offset_fault",
                "Out_of_bounds_fault": "out_of_bounds_fault",
                "High_variance_fault": "high_variance_fault",
                "Data_loss_fault": "data_loss_fault",
            },
            inplace=True,
        )

        return model_output

    @staticmethod
    def predict_faults_lstm(input_variables):

        input_variables = pd.DataFrame(input_variables)
        output_variables = pd.DataFrame()
        map_columns = {
            "datetime": "Datetime",
            "device_id": "Device_id",
            "s1_pm2.5": "Sensor1_PM2.5",
            "s2_pm2.5": "Sensor2_PM2.5",
        }
        input_variables.rename(columns=map_columns, inplace=True)

        X = input_variables[["Sensor1_PM2.5", "Sensor2_PM2.5"]].values

        input_variables["Datetime"] = pd.to_datetime(
            input_variables["Datetime"]
        ).dt.strftime("%Y-%m-%dT%H:%M:%S.%f%z")

        scaler = pickle.load(open(SCALER, "rb"))

        savedModel = load_model(LSTM_MODEL)
        X = scaler.transform(X)

        output = savedModel.predict(X)
        output_variables["Datetime"] = input_variables["Datetime"]
        output_variables["Device_id"] = input_variables["Device_id"]
        output_variables[
            [
                "Offset_fault",
                "Out_of_bounds_fault",
                "Data_loss_fault",
                "High_variance_fault",
            ]
        ] = np.where(output > 0.5, 1, 0)

        output_variables.rename(
            columns={
                "Datetime": "datetime",
                "Device_id": "device_id",
                "Offset_fault": "offset_fault",
                "Out_of_bounds_fault": "out_of_bounds_fault",
                "High_variance_fault": "high_variance_fault",
                "Data_loss_fault": "data_loss_fault",
            },
            inplace=True,
        )

        return output_variables
