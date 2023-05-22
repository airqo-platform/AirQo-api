import argparse
import os
from datetime import datetime, timedelta
from pathlib import Path

import json
import pandas as pd
from dotenv import load_dotenv

from airqo_etl_utils.airnow_utils import AirnowDataUtils
from airqo_etl_utils.airqo_api import AirQoApi
from airqo_etl_utils.airqo_utils import AirQoDataUtils
from airqo_etl_utils.arg_parse_validator import valid_datetime_format
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.calibration_utils import CalibrationUtils
from airqo_etl_utils.constants import (
    Frequency,
    Tenant,
    DeviceCategory,
    DataType,
    DataSource,
)
from airqo_etl_utils.data_validator import DataValidationUtils
from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils
from airqo_etl_utils.kcca_utils import KccaUtils
from airqo_etl_utils.urban_better_utils import UrbanBetterUtils
from airqo_etl_utils.utils import Utils
from airqo_etl_utils.weather_data_utils import WeatherDataUtils
from airqo_etl_utils.airnow_api import AirNowApi
from airqo_etl_utils.date import date_to_str
from airqo_etl_utils.message_broker_utils import MessageBrokerUtils

BASE_DIR = Path(__file__).resolve().parent
dotenv_path = os.path.join(BASE_DIR, ".env")

load_dotenv(dotenv_path)


class MainClass:
    def __init__(
        self, start_date_time=None, end_date_time=None, dataframe_export_format=None
    ) -> None:
        super().__init__()
        hour = datetime.utcnow() - timedelta(hours=1)
        self.start_date_time = (
            start_date_time if start_date_time else date_to_str_hours(hour)
        )
        self.end_date_time = (
            end_date_time
            if end_date_time
            else datetime.strftime(hour, "%Y-%m-%dT%H:59:59Z")
        )
        self.bigquery_api = BigQueryApi()
        self.dataframe_export_format = (
            "csv" if dataframe_export_format is None else dataframe_export_format
        )

    def export_dataframe(self, file_name, dataframe):
        if self.dataframe_export_format == "csv":
            dataframe.to_csv(f"{file_name}.csv", index=False)

    def calibrate_historical_airqo_data(self):
        hourly_uncalibrated_data = AirQoDataUtils.extract_uncalibrated_data(
            start_date_time=self.start_date_time, end_date_time=self.end_date_time
        )

        hourly_weather_data = WeatherDataUtils.extract_hourly_weather_data(
            start_date_time=self.start_date_time, end_date_time=self.end_date_time
        )
        self.export_dataframe(
            file_name="historical_weather_data", dataframe=hourly_weather_data
        )

        merged_data = AirQoDataUtils.merge_aggregated_weather_data(
            airqo_data=hourly_uncalibrated_data,
            weather_data=hourly_weather_data,
        )
        self.export_dataframe(file_name="historical_merged_data", dataframe=merged_data)

        calibrated_data = CalibrationUtils.calibrate_airqo_data(
            data=merged_data,
        )
        self.export_dataframe(
            file_name="historical_calibrated_data", dataframe=calibrated_data
        )

        data = DataValidationUtils.process_for_big_query(
            dataframe=calibrated_data,
            table=self.bigquery_api.hourly_measurements_table,
            tenant=Tenant.AIRQO,
        )
        self.export_dataframe(
            file_name="bigquery_historical_calibrated_data", dataframe=data
        )

        data = pd.read_csv("bigquery_historical_calibrated_data.csv")
        self.bigquery_api.reload_data(
            tenant=Tenant.AIRQO,
            table=self.bigquery_api.hourly_measurements_table,
            null_cols=["pm2_5_calibrated_value"],
            dataframe=data,
            start_date_time=self.start_date_time,
            end_date_time=self.end_date_time,
        )

    def urban_better_data_from_air_beam_csv(self, no_of_files):
        from airqo_etl_utils.urban_better_utils import UrbanBetterUtils

        no_of_files += 1

        for x in range(1, no_of_files + 1):
            data = pd.read_csv(f"dataset_{x}.csv")

            measurements = UrbanBetterUtils.format_air_beam_data_from_csv(
                data=data,
            )

            measurements.to_csv(
                f"urban_better_air_beam_measurements_{x}.csv", index=False
            )

            bigquery_data = DataValidationUtils.process_for_big_query(
                dataframe=measurements,
                tenant=Tenant.URBAN_BETTER,
                table=self.bigquery_api.clean_mobile_raw_measurements_table,
            )
            bigquery_data.to_csv(
                f"urban_better_air_beam_bigquery_data_{x}.csv", index=False
            )

            self.bigquery_api.load_data(
                dataframe=bigquery_data,
                table=self.bigquery_api.clean_mobile_raw_measurements_table,
            )
            self.bigquery_api.load_data(
                dataframe=bigquery_data,
                table=self.bigquery_api.unclean_mobile_raw_measurements_table,
            )

    def urban_better_data_from_plume_labs(self):
        from airqo_etl_utils.plume_labs_utils import PlumeLabsUtils

        measures = PlumeLabsUtils.extract_sensor_measures(
            start_date_time=self.start_date_time,
            end_date_time=self.end_date_time,
            tenant=Tenant.URBAN_BETTER,
        )
        measures.to_csv("measures_data.csv", index=False)

        sensor_positions = PlumeLabsUtils.extract_sensor_positions(
            start_date_time=self.start_date_time,
            end_date_time=self.end_date_time,
            tenant=Tenant.URBAN_BETTER,
        )
        sensor_positions.to_csv("sensor_positions_data.csv", index=False)

        measures = pd.read_csv("measures_data.csv")
        sensor_positions = pd.read_csv("sensor_positions_data.csv")

        un_clean_urban_better_data = PlumeLabsUtils.merge_sensor_measures_and_positions(
            measures=measures,
            sensor_positions=sensor_positions,
        )
        self.export_dataframe(
            file_name="unclean_urban_better_data",
            dataframe=un_clean_urban_better_data,
        )

        bigquery_data = DataValidationUtils.process_for_big_query(
            dataframe=un_clean_urban_better_data,
            tenant=Tenant.URBAN_BETTER,
            table=self.bigquery_api.unclean_mobile_raw_measurements_table,
        )
        self.export_dataframe(
            file_name="unclean_urban_better_bigquery_data", dataframe=bigquery_data
        )

        clean_urban_better_data = PlumeLabsUtils.clean_data(
            data=un_clean_urban_better_data,
        )
        self.export_dataframe(
            file_name="clean_urban_better_data", dataframe=clean_urban_better_data
        )

        bigquery_data = DataValidationUtils.process_for_big_query(
            dataframe=clean_urban_better_data,
            tenant=Tenant.URBAN_BETTER,
            table=self.bigquery_api.clean_mobile_raw_measurements_table,
        )
        self.export_dataframe(
            file_name="clean_urban_better_bigquery_data", dataframe=bigquery_data
        )

    def data_warehouse(self):
        hourly_low_cost_data = DataWarehouseUtils.extract_hourly_low_cost_data(
            start_date_time=self.start_date_time, end_date_time=self.end_date_time
        )
        self.export_dataframe(
            file_name="hourly_low_cost_data", dataframe=hourly_low_cost_data
        )

        hourly_bam_data = DataWarehouseUtils.extract_hourly_bam_data(
            start_date_time=self.start_date_time, end_date_time=self.end_date_time
        )
        self.export_dataframe(file_name="hourly_bam_data", dataframe=hourly_bam_data)

        hourly_weather_data = DataWarehouseUtils.extract_hourly_weather_data(
            start_date_time=self.start_date_time, end_date_time=self.end_date_time
        )
        self.export_dataframe(
            file_name="hourly_weather_data", dataframe=hourly_weather_data
        )

        sites_data = DataWarehouseUtils.extract_sites_meta_data()
        self.export_dataframe(file_name="sites_data", dataframe=sites_data)

        analytics_data = DataWarehouseUtils.merge_datasets(
            bam_data=hourly_bam_data,
            low_cost_data=hourly_low_cost_data,
            weather_data=hourly_weather_data,
            sites_info=sites_data,
        )
        self.export_dataframe(file_name="analytics_data", dataframe=analytics_data)

        analytics_data = DataValidationUtils.process_for_big_query(
            dataframe=analytics_data,
            table=BigQueryApi().consolidated_data_table,
        )
        self.export_dataframe(
            file_name="big_query_analytics_data", dataframe=analytics_data
        )

    def airqo_realtime_data(self):
        low_cost_sensors_data = AirQoDataUtils.extract_devices_data(
            start_date_time=self.start_date_time,
            end_date_time=self.end_date_time,
            device_category=DeviceCategory.LOW_COST,
        )
        self.export_dataframe(
            dataframe=low_cost_sensors_data, file_name="low_cost_sensors_data"
        )

        bigquery_data = AirQoDataUtils.process_raw_data_for_bigquery(
            data=low_cost_sensors_data
        )
        self.export_dataframe(
            dataframe=bigquery_data, file_name="low_cost_sensors_bigquery_data"
        )

        aggregated_sensors_data = AirQoDataUtils.aggregate_low_cost_sensors_data(
            data=low_cost_sensors_data
        )
        self.export_dataframe(
            dataframe=aggregated_sensors_data, file_name="aggregated_sensors_data"
        )

        aggregated_weather_data = WeatherDataUtils.extract_hourly_data(
            start_date_time=self.start_date_time, end_date_time=self.end_date_time
        )
        self.export_dataframe(
            dataframe=aggregated_weather_data, file_name="aggregated_weather_data"
        )
        aggregated_weather_data = pd.read_csv("aggregated_weather_data.csv")

        merged_data = AirQoDataUtils.merge_aggregated_weather_data(
            airqo_data=aggregated_sensors_data, weather_data=aggregated_weather_data
        )
        self.export_dataframe(dataframe=merged_data, file_name="merged_data")

        calibrated_data = CalibrationUtils.calibrate_airqo_data(data=merged_data)
        self.export_dataframe(dataframe=calibrated_data, file_name="calibrated_data")

        latest_data = AirQoDataUtils.process_latest_data(
            calibrated_data, device_category=DeviceCategory.LOW_COST
        )
        latest_data.to_csv("airqo_latest_data.csv", index=False)

        bigquery_data = AirQoDataUtils.process_aggregated_data_for_bigquery(
            data=calibrated_data
        )
        self.export_dataframe(
            dataframe=bigquery_data, file_name="calibrated_bigquery_data"
        )

        message_broker_data = AirQoDataUtils.process_data_for_message_broker(
            data=calibrated_data, frequency=Frequency.HOURLY
        )
        self.export_dataframe(
            dataframe=pd.DataFrame(message_broker_data), file_name="message_broker_data"
        )

    def kcca_realtime_data(self):
        kcca_data = KccaUtils.extract_data(
            start_date_time=self.start_date_time, end_date_time=self.end_date_time
        )
        self.export_dataframe(file_name="kcca_unstructured_data", dataframe=kcca_data)

        clean_data = KccaUtils.transform_data(data=kcca_data)
        self.export_dataframe(file_name="kcca_clean_data", dataframe=clean_data)

        message_broker_data = KccaUtils.transform_data_for_message_broker(
            data=clean_data
        )
        self.export_dataframe(
            file_name="kcca_message_broker_data",
            dataframe=pd.DataFrame(message_broker_data),
        )

        big_query_data = DataValidationUtils.process_for_big_query(
            dataframe=clean_data,
            table=self.bigquery_api.hourly_measurements_table,
        )
        self.export_dataframe(file_name="kcca_big_query_data", dataframe=big_query_data)

        kcca_latest_data = KccaUtils.process_latest_data(clean_data)
        kcca_latest_data.to_csv("kcca_latest_data.csv", index=False)

    def airnow_bam_data(self):
        airnow_api = AirNowApi()
        networks = airnow_api.get_networks()
        extracted_bam_data = pd.DataFrame()
        for network in networks:
            if network["data_source"] == DataSource.AIRNOW:
                network_data = AirnowDataUtils.extract_bam_data(
                    api_key=network["api_key"],
                    start_date_time=self.start_date_time,
                    end_date_time=self.end_date_time,
                )
            extracted_bam_data = pd.concat(
                [extracted_bam_data, network_data], ignore_index=True
            )

        extracted_bam_data.to_csv("airnow_unprocessed_data.csv", index=False)
        with open("airnow_unprocessed_data.json", "w") as f:
            json.dump(extracted_bam_data.to_dict(orient="records"), f)

        processed_bam_data = pd.DataFrame()
        for network in networks:
            network_data = AirnowDataUtils.process_bam_data(
                data=extracted_bam_data, tenant=network["network"]
            )
            processed_bam_data = pd.concat(
                [processed_bam_data, network_data], ignore_index=True
            )

        processed_bam_data.to_csv("airnow_processed_data.csv", index=False)
        processed_bam_data["timestamp"] = processed_bam_data["timestamp"].dt.strftime(
            "%Y-%m-%d %H:%M:%S"
        )
        with open("airnow_processed_data.json", "w") as f:
            json.dump(processed_bam_data.to_dict(orient="records"), f)

        bigquery_data = pd.DataFrame()
        for network in networks:
            network_data = DataValidationUtils.process_for_big_query(
                dataframe=processed_bam_data,
                tenant=network["network"],
                table=self.bigquery_api.bam_measurements_table,
            )
            bigquery_data = pd.concat([bigquery_data, network_data], ignore_index=True)

        bigquery_data.to_csv("airnow_bigquery_data.csv", index=False)
        bigquery_data["timestamp"] = pd.to_datetime(bigquery_data["timestamp"])
        bigquery_data["timestamp"] = bigquery_data["timestamp"].apply(date_to_str)
        with open("airnow_bigquery_data.json", "w") as f:
            json.dump(bigquery_data.to_dict(orient="records"), f)

        message_broker_data = MessageBrokerUtils.update_hourly_data_topic(
            processed_bam_data
        )

        message_broker_data.to_csv("airnow_message_broker_data.csv", index=False)
        message_broker_data["timestamp"] = pd.to_datetime(
            message_broker_data["timestamp"]
        )
        message_broker_data["timestamp"] = message_broker_data["timestamp"].apply(
            date_to_str
        )
        with open("airnow_message_broker_data.json", "w") as f:
            json.dump(message_broker_data.to_dict(orient="records"), f)

    def airqo_bam_data(self):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        extracted_bam_data = AirQoDataUtils.extract_devices_data(
            start_date_time=self.start_date_time,
            end_date_time=self.end_date_time,
            device_category=DeviceCategory.BAM,
        )
        extracted_bam_data.to_csv("airqo_bam_unprocessed_data.csv", index=False)

        processed_bam_data = AirQoDataUtils.clean_bam_data(extracted_bam_data)
        processed_bam_data.to_csv("airqo_bam_processed_data.csv", index=False)

        bigquery_data = AirQoDataUtils.format_data_for_bigquery(
            data=processed_bam_data, data_type=DataType.CLEAN_BAM_DATA
        )
        bigquery_data.to_csv("airqo_bam_bigquery_data.csv", index=False)

        latest_data = AirQoDataUtils.process_latest_data(
            data=processed_bam_data, device_category=DeviceCategory.BAM
        )

    def meta_data(self):
        from airqo_etl_utils.meta_data_utils import MetaDataUtils

        sites = MetaDataUtils.extract_sites_from_api()
        bigquery_data = DataValidationUtils.process_for_big_query(
            dataframe=sites, table=self.bigquery_api.sites_table
        )
        bigquery_data.to_csv(path_or_buf="bigquery_sites_data.csv", index=False)
        self.bigquery_api.update_sites_and_devices(
            dataframe=bigquery_data,
            table=self.bigquery_api.sites_table,
            component="sites",
        )

        devices = MetaDataUtils.extract_devices_from_api()
        bigquery_data = DataValidationUtils.process_for_big_query(
            dataframe=devices, table=self.bigquery_api.devices_table
        )
        bigquery_data.to_csv(path_or_buf="bigquery_devices_data.csv", index=False)
        self.bigquery_api.update_sites_and_devices(
            dataframe=bigquery_data,
            table=self.bigquery_api.devices_table,
            component="devices",
        )


def data_warehouse(start_date_time: str, end_date_time: str):
    from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils

    hourly_low_cost_data = DataWarehouseUtils.extract_hourly_low_cost_data(
        start_date_time=start_date_time, end_date_time=end_date_time
    )
    hourly_low_cost_data.to_csv(path_or_buf="hourly_low_cost_data.csv", index=False)

    hourly_bam_data = DataWarehouseUtils.extract_hourly_bam_data(
        start_date_time=start_date_time, end_date_time=end_date_time
    )
    hourly_bam_data.to_csv(path_or_buf="hourly_bam_data.csv", index=False)

    hourly_weather_data = DataWarehouseUtils.extract_hourly_weather_data(
        start_date_time=start_date_time, end_date_time=end_date_time
    )
    hourly_weather_data.to_csv(path_or_buf="hourly_weather_data.csv", index=False)

    sites_data = DataWarehouseUtils.extract_sites_info()
    sites_data.to_csv(path_or_buf="sites_data.csv", index=False)

    hourly_low_cost_data = pd.read_csv("hourly_low_cost_data.csv")
    hourly_bam_data = pd.read_csv("hourly_bam_data.csv")
    hourly_weather_data = pd.read_csv("hourly_weather_data.csv")
    sites_data = pd.read_csv("sites_data.csv")

    consolidated_data = DataWarehouseUtils.merge_datasets(
        bam_data=hourly_bam_data,
        low_cost_data=hourly_low_cost_data,
        weather_data=hourly_weather_data,
        sites_info=sites_data,
    )
    consolidated_data.to_csv(path_or_buf="consolidated_data.csv", index=False)

    data = DataWarehouseUtils.format_data_for_bigquery(data=consolidated_data)
    data.to_csv(path_or_buf="consolidated_data.csv", index=False)


def airqo_historical_hourly_data():
    start_date_time = "2022-01-01T10:00:00Z"
    end_date_time = "2022-01-01T17:00:00Z"

    hourly_device_measurements = AirQoDataUtils.extract_aggregated_raw_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
    )
    hourly_device_measurements.to_csv(
        path_or_buf="hourly_device_measurements.csv", index=False
    )

    hourly_weather_data = WeatherDataUtils.extract_hourly_weather_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
    )
    hourly_weather_data.to_csv(path_or_buf="hourly_weather_data.csv", index=False)

    merged_data = AirQoDataUtils.merge_aggregated_weather_data(
        airqo_data=hourly_device_measurements, weather_data=hourly_weather_data
    )
    merged_data.to_csv(path_or_buf="merged_data.csv", index=False)

    calibrated_data = CalibrationUtils.calibrate_airqo_data(data=merged_data)
    calibrated_data.export_dataframe(path_or_buf="calibrated_data.csv", index=False)

    bigquery_data = AirQoDataUtils.process_aggregated_data_for_bigquery(
        data=calibrated_data
    )
    bigquery_data.to_csv(path_or_buf="bigquery_data.csv", index=False)


def airqo_historical_raw_data():
    start_date_time = "2022-01-01T10:00:00Z"
    end_date_time = "2022-01-01T17:00:00Z"

    low_cost_sensors_data = AirQoDataUtils.extract_devices_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        device_category=DeviceCategory.LOW_COST,
    )
    low_cost_sensors_data.to_csv(path_or_buf="low_cost_sensors_data.csv", index=False)

    deployment_logs = AirQoDataUtils.extract_devices_deployment_logs()
    deployment_logs.to_csv(path_or_buf="deployment_logs.csv", index=False)

    historical_data = AirQoDataUtils.map_site_ids_to_historical_data(
        data=low_cost_sensors_data, deployment_logs=deployment_logs
    )
    historical_data.to_csv(path_or_buf="historical_data.csv", index=False)

    bigquery_data = AirQoDataUtils.process_raw_data_for_bigquery(data=historical_data)
    bigquery_data.to_csv(path_or_buf="bigquery_data.csv", index=False)


def weather_data(start_date_time, end_date_time, file):
    # start_date_time = "2022-01-01T10:00:00Z"
    # end_date_time = "2022-01-01T17:00:00Z"

    raw_weather_data = WeatherDataUtils.query_raw_data_from_tahmo(
        start_date_time=start_date_time, end_date_time=end_date_time
    )
    # raw_weather_data.to_csv(path_or_buf="raw_weather_data.csv", index=False)

    cleaned_weather_data = WeatherDataUtils.transform_raw_data(data=raw_weather_data)
    # cleaned_weather_data.to_csv(path_or_buf="cleaned_weather_data.csv", index=False)

    hourly_weather_data = WeatherDataUtils.aggregate_data(data=cleaned_weather_data)
    hourly_weather_data.to_csv(path_or_buf=f"{file}.csv", index=False)

    # bigquery_weather_data = WeatherDataUtils.transform_for_bigquery(
    #     data=hourly_weather_data
    # )
    # bigquery_weather_data.to_csv(path_or_buf="bigquery_weather_data.csv", index=False)


def nasa_purple_air_data():
    from airqo_etl_utils.purple_air_utils import PurpleDataUtils

    extracted_data = PurpleDataUtils.extract_data(
        start_date_time="2022-07-28T19:00:00Z", end_date_time="2022-07-28T19:59:59Z"
    )
    extracted_data.to_csv("purple_air_unprocessed_data.csv", index=False)

    processed_data = PurpleDataUtils.process_data(extracted_data)
    processed_data.to_csv("purple_air_processed_data.csv", index=False)

    bigquery_data = PurpleDataUtils.process_for_bigquery(processed_data)
    bigquery_data.to_csv("purple_air_bigquery_data.csv", index=False)


def urban_better_data_from_plume_labs():
    from airqo_etl_utils.plume_labs_utils import PlumeLabsUtils

    start_date_time = "2022-08-13T00:00:00Z"
    end_date_time = "2022-08-13T23:59:59Z"
    start_date_time = "2022-07-30T00:00:00Z"
    end_date_time = "2022-07-31T00:00:00Z"
    measurements = UrbanBetterUtils.extract_raw_data_from_plume_labs(
        start_date_time=start_date_time, end_date_time=end_date_time
    )
    measurements.to_csv("urban_better_unprocessed_data.csv", index=False)

    measures = PlumeLabsUtils.extract_sensor_measures(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        tenant=Tenant.URBAN_BETTER,
    )
    measures.to_csv("measures_data.csv", index=False)

    sensor_positions = PlumeLabsUtils.extract_sensor_positions(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        tenant=Tenant.URBAN_BETTER,
    )
    sensor_positions.to_csv("sensor_positions_data.csv", index=False)

    measures = pd.read_csv("measures_data.csv")
    sensor_positions = pd.read_csv("sensor_positions_data.csv")

    for file in [
        "user_positions_1.csv",
        "user_positions_2.csv",
        "user_positions_3.csv",
    ]:
        data = pd.read_csv(file)
        data = data[["date", "latitude", "longitude"]]
        data.rename(columns={"date": "timestamp"}, inplace=True)

        if file == "user_positions_1.csv":
            data.loc[:, "device_number"] = 18566
            data.loc[:, "device_id"] = "02:00:00:00:47:8e"

        if file == "user_positions_2.csv":
            data.loc[:, "device_number"] = 18567
            data.loc[:, "device_id"] = "02:00:00:00:47:8f"

        if file == "user_positions_3.csv":
            data.loc[:, "device_number"] = 18559
            data.loc[:, "device_id"] = "02:00:00:00:47:87"

        sensor_positions = pd.concat([sensor_positions, data])

    un_clean_urban_better_data = PlumeLabsUtils.merge_sensor_measures_and_positions(
        measures=measures,
        sensor_positions=sensor_positions,
    )
    un_clean_urban_better_data.to_csv("urban_better_unprocessed_data.csv", index=False)

    bigquery_api = BigQueryApi()
    un_clean_urban_better_data = pd.read_csv("urban_better_unprocessed_data.csv")
    un_clean_urban_better_data.dropna(subset=["latitude", "longitude"], inplace=True)

    bigquery_data = DataValidationUtils.process_for_big_query(
        dataframe=un_clean_urban_better_data,
        tenant=Tenant.URBAN_BETTER,
        table=bigquery_api.unclean_mobile_raw_measurements_table,
    )
    bigquery_api.load_data(
        dataframe=bigquery_data,
        table=bigquery_api.unclean_mobile_raw_measurements_table,
    )

    clean_urban_better_data = PlumeLabsUtils.clean_data(
        data=un_clean_urban_better_data,
    )
    clean_urban_better_data.to_csv("urban_better_processed_data.csv", index=False)

    bigquery_data = DataValidationUtils.process_for_big_query(
        dataframe=clean_urban_better_data,
        tenant=Tenant.URBAN_BETTER,
        table=bigquery_api.clean_mobile_raw_measurements_table,
    )
    bigquery_api.load_data(
        dataframe=bigquery_data, table=bigquery_api.clean_mobile_raw_measurements_table
    )


def urban_better_data_from_bigquery():
    from airqo_etl_utils.urban_better_utils import UrbanBetterUtils
    from airqo_etl_utils.data_validator import DataValidationUtils

    bigquery_api = BigQueryApi()
    data = bigquery_api.query_data(
        start_date_time="2022-01-01T00:00:00Z",
        end_date_time="2023-01-01T00:00:00Z",
        table=bigquery_api.clean_mobile_raw_measurements_table,
        tenant=Tenant.URBAN_BETTER,
    )

    data.to_csv("urban_better_big_query_data_backup.csv", index=False)

    data = UrbanBetterUtils.add_air_quality(data)
    data.to_csv("urban_better_processed_data.csv", index=False)

    bigquery_data = pd.DataFrame(
        DataValidationUtils.process_for_big_query(
            dataframe=data,
            tenant=Tenant.URBAN_BETTER,
            table=BigQueryApi().clean_mobile_raw_measurements_table,
        )
    )
    bigquery_data.to_csv("urban_better_bigquery_data.csv", index=False)


def airqo_mobile_device_measurements():
    from airqo_etl_utils.airqo_utils import AirQoDataUtils
    from airqo_etl_utils.weather_data_utils import WeatherDataUtils

    input_meta_data = [
        {
            "latitude": 0.2959788757479883,
            "longitude": 32.57946554294726,
            "start_date_time": "2022-07-20T10:00:00Z",
            "end_date_time": "2022-07-20T18:00:00Z",
            "device_number": 1575539,
        },
        {
            "latitude": 0.2959788757479883,
            "longitude": 32.57946554294726,
            "start_date_time": "2022-07-20T10:00:00Z",
            "end_date_time": "2022-07-20T18:00:00Z",
            "device_number": 1606118,
        },
        {
            "latitude": 0.30112943343101545,
            "longitude": 32.587149313048286,
            "start_date_time": "2022-07-21T10:00:00Z",
            "end_date_time": "2022-07-21T18:00:00Z",
            "device_number": 1351544,
        },
        {
            "latitude": 0.30112943343101545,
            "longitude": 32.587149313048286,
            "start_date_time": "2022-07-21T10:00:00Z",
            "end_date_time": "2022-07-21T18:00:00Z",
            "device_number": 1371829,
        },
    ]

    raw_data = AirQoDataUtils.extract_mobile_low_cost_sensors_data(
        meta_data=input_meta_data
    )
    raw_data.to_csv("raw_device_measurements_data.csv", index=False)

    aggregated_mobile_devices_data = AirQoDataUtils.aggregate_low_cost_sensors_data(
        raw_data
    )
    aggregated_mobile_devices_data.to_csv(
        "aggregated_mobile_devices_data.csv", index=False
    )

    weather_stations = WeatherDataUtils.get_weather_stations(meta_data=input_meta_data)
    weather_stations.to_csv("weather_stations.csv", index=False)

    mobile_devices_weather_data = (
        AirQoDataUtils.extract_aggregated_mobile_devices_weather_data(
            data=weather_stations
        )
    )
    mobile_devices_weather_data.to_csv("mobile_devices_weather_data.csv", index=False)

    merged_mobile_devices_data = (
        AirQoDataUtils.merge_aggregated_mobile_devices_data_and_weather_data(
            measurements=aggregated_mobile_devices_data,
            weather_data=mobile_devices_weather_data,
        )
    )
    merged_mobile_devices_data.dropna(
        subset=["s1_pm2_5", "s2_pm2_5", "s1_pm10", "s2_pm10"], how="all", inplace=True
    )
    merged_mobile_devices_data.to_csv("merged_mobile_devices_data.csv", index=False)

    merged_mobile_devices_data = pd.read_csv("merged_mobile_devices_data.csv")

    calibrated_mobile_devices_data = CalibrationUtils.calibrate_airqo_data(
        data=merged_mobile_devices_data
    )
    calibrated_mobile_devices_data.export_dataframe(
        "calibrated_mobile_devices_data.csv", index=False
    )

    calibrated_mobile_devices_data = pd.read_csv("calibrated_mobile_devices_data.csv")

    bigquery_data = AirQoDataUtils.restructure_airqo_mobile_data_for_bigquery(
        calibrated_mobile_devices_data
    )
    bigquery_api = BigQueryApi()
    bigquery_data = bigquery_api.validate_data(
        dataframe=bigquery_data, table=bigquery_api.airqo_mobile_measurements_table
    )
    bigquery_data.to_csv("bigquery_mobile_devices_data.csv", index=False)
    bigquery_api.load_data(
        dataframe=bigquery_data, table=bigquery_api.airqo_mobile_measurements_table
    )


def airqo_historical_csv_bam_data():
    """
    Processes AirQo reference monitors data from a csv file "airqo_historical_bam_data.csv"
    into a format that is required for storage in BigQuery reference monitors data table.

    The resultant file "airqo_bam_bigquery_data.csv" contains data that matches the format required by BigQuery
    reference monitors data table and hence, ready for import.

    The input csv file is assumed to have stored data for the reference monitors
    1192542 and 1192541 as -24517  and -24516 respectively.
    """

    from airqo_etl_utils.airqo_utils import AirQoDataUtils

    devices = AirQoApi().get_devices(
        tenant=Tenant.AIRQO, device_category=DeviceCategory.BAM
    )

    unclean_data = pd.read_csv(
        "airqo_historical_bam_data.csv",
    )

    def update_device_details(device_number):
        device_id = None
        device = []
        if device_number == -24517:
            device_number = 1192542
            device = list(
                filter(lambda x: (x["device_number"] == device_number), devices)
            )

        if device_number == -24516:
            device_number = 1192541
            device = list(
                filter(lambda x: (x["device_number"] == device_number), devices)
            )

        if device:
            device_id = dict(device[0]).get("name", None)

        return pd.Series({"device_number": device_number, "device_id": device_id})

    unclean_data[["device_number", "device_id"]] = unclean_data["device_number"].apply(
        lambda x: update_device_details(x)
    )

    bigquery_data = AirQoDataUtils.format_data_for_bigquery(
        data=unclean_data, data_type=DataType.UNCLEAN_BAM_DATA
    )
    bigquery_data.to_csv("airqo_unclean_bam_bigquery_data.csv", index=False)

    clean_data = AirQoDataUtils.clean_bam_data(data=unclean_data)
    bigquery_data = AirQoDataUtils.format_data_for_bigquery(
        data=clean_data, data_type=DataType.CLEAN_BAM_DATA
    )
    bigquery_data.to_csv("airqo_clean_bam_bigquery_data.csv", index=False)


def airqo_historical_api_bam_data():
    from airqo_etl_utils.airqo_utils import AirQoDataUtils

    start_date_time = "2022-08-01T00:00:00Z"
    end_date_time = "2022-09-01T00:00:00Z"

    unclean_data = AirQoDataUtils.extract_devices_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        device_category=DeviceCategory.BAM,
    )
    unclean_data.to_csv("unclean_airqo_bam_data.csv", index=False)

    clean_bam_data = AirQoDataUtils.clean_bam_data(unclean_data)
    clean_bam_data.to_csv("clean_airqo_bam_data.csv", index=False)

    unclean_data = AirQoDataUtils.format_data_for_bigquery(
        data=unclean_data, data_type=DataType.CLEAN_BAM_DATA
    )
    unclean_data.to_csv("bigquery_unclean_airqo_bam_data.csv", index=False)

    clean_bam_data = AirQoDataUtils.format_data_for_bigquery(
        data=clean_bam_data, data_type=DataType.CLEAN_BAM_DATA
    )
    clean_bam_data.to_csv("bigquery_clean_airqo_bam_data.csv", index=False)


def download_weather_data():
    bigquery_api = BigQueryApi()

    for year in [2019, 2020, 2021]:
        dates = Utils.year_months_query_array(year)
        for start, end in dates:
            data = bigquery_api.query_data(
                start_date_time=start,
                end_date_time=end,
                table=bigquery_api.hourly_weather_table,
            )
            data.to_csv(
                f"/Users/noah/data/historical_data/weather_data/aggregated/{start}-{end}.csv",
                index=False,
            )
            print(f"{start}-{end} completed\n")


if __name__ == "__main__":
    from airqo_etl_utils.date import date_to_str_hours

    hour_of_day = datetime.utcnow() - timedelta(days=14)
    default_args_start = date_to_str_hours(hour_of_day)
    default_args_end = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

    parser = argparse.ArgumentParser(description="Test functions configuration")
    parser.add_argument(
        "--start",
        default=default_args_start,
        required=False,
        type=valid_datetime_format,
        help='start datetime in format "yyyy-MM-ddThh:mm:ssZ"',
    )
    parser.add_argument(
        "--end",
        required=False,
        default=default_args_end,
        type=valid_datetime_format,
        help='end datetime in format "yyyy-MM-ddThh:mm:ssZ"',
    )
    parser.add_argument(
        "--file",
        required=False,
        type=str.lower,
    )
    parser.add_argument(
        "--tenant",
        required=False,
        type=str.lower,
        default="airqo",
    )
    parser.add_argument(
        "--action",
        required=True,
        type=str.lower,
        help="range interval in minutes",
        choices=[
            "airqo_realtime_data",
            "airqo_historical_raw_data",
            "airqo_historical_hourly_data",
            "weather_data",
            "data_warehouse",
            "kcca_hourly_data",
            "meta_data",
            "calibrate_historical_airqo_data",
            "airnow_bam_data",
            "urban_better_data_plume_labs",
            "urban_better_data_air_beam",
            "airqo_mobile_device_measurements",
            "airqo_bam_data",
            "nasa_purple_air_data",
            "airqo_historical_bam_data",
            "airqo_historical_api_bam_data",
        ],
    )

    args = parser.parse_args()

    main_class = MainClass(start_date_time=args.start, end_date_time=args.end)

    if args.action == "airqo_realtime_data":
        main_class.airqo_realtime_data()

    if args.action == "airqo_historical_raw_data":
        airqo_historical_raw_data()

    if args.action == "airqo_historical_hourly_data":
        airqo_historical_hourly_data()

    elif args.action == "weather_data":
        weather_data(start_date_time=args.start, end_date_time=args.end, file=args.file)

    elif args.action == "data_warehouse":
        main_class.data_warehouse()

    elif args.action == "kcca_hourly_data":
        main_class.kcca_realtime_data()

    elif args.action == "meta_data":
        main_class.meta_data()

    elif args.action == "calibrate_historical_airqo_data":
        main_class.calibrate_historical_airqo_data()

    elif args.action == "airnow_bam_data":
        main_class.airnow_bam_data()

    elif args.action == "airqo_historical_csv_bam_data":
        airqo_historical_csv_bam_data()

    elif args.action == "airqo_historical_api_bam_data":
        airqo_historical_api_bam_data()

    elif args.action == "airqo_bam_data":
        main_class.airqo_bam_data()

    elif args.action == "nasa_purple_air_data":
        nasa_purple_air_data()

    elif args.action == "urban_better_data_plume_labs":
        urban_better_data_from_plume_labs()

    elif args.action == "urban_better_data_biq_query":
        urban_better_data_from_bigquery()

    elif args.action == "urban_better_data_air_beam":
        main_class.urban_better_data_from_air_beam_csv(no_of_files=3)

    elif args.action == "airqo_mobile_device_measurements":
        airqo_mobile_device_measurements()

    else:
        pass
