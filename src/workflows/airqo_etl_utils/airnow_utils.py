import ast
import pandas as pd

from .airnow_api import AirNowApi
from .constants import DataSource, DeviceCategory, Frequency, DeviceNetwork
from .date import str_to_date, date_to_str
from .utils import Utils
from .data_validator import DataValidationUtils
from .datautils import DataUtils
from .config import configuration as Config
import logging

logger = logging.getLogger(__name__)


class AirnowDataUtils:
    @staticmethod
    def query_bam_data(
        api_key: str, start_date_time: str, end_date_time: str
    ) -> pd.DataFrame:
        """
        Queries BAM (Beta Attenuation Monitor) data from the AirNow API within the given date range.

        This function converts the input date strings into the required format for the API,
        retrieves air quality data, and returns it as a Pandas DataFrame.

        Args:
            api_key(str): The API key required for authentication with AirNow.
            start_date_time(str): The start datetime in string format (expected format: "YYYY-MM-DD HH:MM").
            end_date_time(str): The end datetime in string format (expected format: "YYYY-MM-DD HH:MM").

        Returns:
            pd.DataFrame: A DataFrame containing the air quality data retrieved from the AirNow API.

        Example:
            >>> df = query_bam_data("your_api_key", "2024-03-01 00:00", "2024-03-02 23:59")
            >>> print(df.head())
        """
        airnow_api = AirNowApi()
        date_format = "%Y-%m-%dT%H:%M"
        start_date_time = date_to_str(
            str_to_date(start_date_time), str_format=date_format
        )
        end_date_time = date_to_str(str_to_date(end_date_time), str_format=date_format)

        data = airnow_api.get_data(
            api_key=api_key,
            start_date_time=start_date_time,
            boundary_box="-16.9530804676,-33.957634112,54.8058474018,37.2697926495",
            end_date_time=end_date_time,
        )

        return pd.DataFrame(data) if data else pd.DataFrame()

    @staticmethod
    def extract_bam_data(start_date_time: str, end_date_time: str) -> pd.DataFrame:
        """
        Extracts BAM (Beta Attenuation Monitor) data from AirNow API for the given date range.

        This function fetches device information for the BAM network, queries data for each device over the specified date range,
        and compiles it into a pandas DataFrame.

        Args:
            start_date_time (str): Start of the date range in ISO 8601 format (e.g., "2024-11-01T00:00:00Z").
            end_date_time (str): End of the date range in ISO 8601 format (e.g., "2024-11-07T23:59:59Z").

        Returns:
            pd.DataFrame: A DataFrame containing BAM data for all devices within the specified date range,
                        including a `network` column indicating the device network.

        Raises:
            ValueError: If no devices are found for the BAM network or if no data is returned for the specified date range.
        """
        bam_data = pd.DataFrame()

        dates = Utils.query_dates_array(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            data_source=DataSource.AIRNOW,
        )

        if not dates:
            raise ValueError("Invalid or empty date range provided.")

        api_key = Config.US_EMBASSY_API_KEY

        all_device_data = []
        device_data = []
        for start, end in dates:
            query_data = AirnowDataUtils.query_bam_data(
                api_key=api_key, start_date_time=start, end_date_time=end
            )
            if not query_data.empty:
                device_data.append(query_data)
        if device_data:
            device_df = pd.concat(device_data, ignore_index=True)
            device_df["network"] = DeviceNetwork.METONE.str
            all_device_data.append(device_df)

        if not all_device_data:
            logger.info("No BAM data found for the specified date range.")

        bam_data = pd.concat(all_device_data, ignore_index=True)

        return bam_data

    @staticmethod
    def process_bam_data(data: pd.DataFrame) -> pd.DataFrame:
        """
        Processes raw BAM device data by matching it to corresponding device details and constructing
        a structured DataFrame of air quality measurements.

        Steps:
        1. Maps each device code to its corresponding device details using a device mapping.
        2. Iterates over the input DataFrame, validates the device details, and retrieves pollutant values.
        3. Constructs a list of air quality measurements with relevant device information and pollutant data.
        4. Removes outliers from the processed data.

        Args:
            data(pd.DataFrame): A DataFrame containing raw BAM device data, with columns such as 'FullAQSCode', 'Parameter', 'Value', 'Latitude', 'Longitude', and 'UTC'.

        Returns:
            pd.DataFrame: A cleaned and structured DataFrame containing processed air quality data. The resulting DataFrame includes columns such as 'timestamp', 'network', 'site_id', 'device_id', and pollutant values ('pm2_5', 'pm10', 'no2', etc.).
        """
        air_now_data = []

        devices, _ = DataUtils.get_devices(
            device_category=DeviceCategory.BAM, device_network=DeviceNetwork.METONE
        )

        pollutant_value = {"pm2_5": None, "pm10": None, "no2": None}

        device_mapping = {
            device_code: device
            for device in devices.to_dict(orient="records")
            for device_code in ast.literal_eval(device.get("device_codes", []))
        }
        for _, row in data.iterrows():
            try:
                # Temp external device id  # Lookup device details based on FullAQSCode
                device_id_ = str(row["FullAQSCode"])
                device_details = device_mapping.get(device_id_)

                if not device_details:
                    logger.exception(f"Device with ID {device_id_} not found")
                    continue

                parameter_col_name = Config.device_config_mapping.get(
                    DeviceCategory.BAM.str, {}
                ).get(row["Parameter"].lower(), None)

                if parameter_col_name and parameter_col_name in pollutant_value:
                    pollutant_value[parameter_col_name] = row["Value"]

                if row["network"] != device_details.get("network"):
                    logger.exception(f"Network mismatch for device ID {device_id_}")
                    continue

                air_now_data.append(
                    {
                        "timestamp": row["UTC"],
                        "network": row["network"],
                        "site_id": device_details.get("site_id"),
                        "device_id": device_details.get("name"),
                        "mongo_id": device_details.get("_id"),
                        "device_number": device_details.get("device_number"),
                        "frequency": Frequency.HOURLY.str,
                        "latitude": row["Latitude"],
                        "longitude": row["Longitude"],
                        "device_category": DeviceCategory.BAM.str,
                        "pm2_5": pollutant_value["pm2_5"],
                        "pm2_5_calibrated_value": pollutant_value["pm2_5"],
                        "pm2_5_raw_value": pollutant_value["pm2_5"],
                        "pm10": pollutant_value["pm10"],
                        "pm10_calibrated_value": pollutant_value["pm10"],
                        "pm10_raw_value": pollutant_value["pm10"],
                        "no2": pollutant_value["no2"],
                        "no2_calibrated_value": pollutant_value["no2"],
                        "no2_raw_value": pollutant_value["no2"],
                    }
                )
            except Exception as e:
                logger.exception(f"Error processing row: {e}")

        air_now_data = pd.DataFrame(air_now_data)
        air_now_data = DataValidationUtils.remove_outliers(air_now_data)

        return air_now_data
