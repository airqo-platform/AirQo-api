import pandas as pd


class DataSummaryUtils:
    @staticmethod
    def compute_devices_summary(data: pd.DataFrame) -> pd.DataFrame:
        """
        Computes a summary of device records from the given dataset.

        This function processes a DataFrame containing device readings, grouping data
        by device and daily timestamps. It calculates the number of hourly records,
        calibrated and uncalibrated records, and their respective percentages.

        Args:
            data (pd.DataFrame): A DataFrame containing device data with at least the columns:
                - timestamp(datetime-like string): The time of the record.
                - device(str): The device identifier.
                - site_id(str): The site identifier.
                - pm2_5_calibrated_value(float): The calibrated PM2.5 value.

        Returns:
            pd.DataFrame: A summary DataFrame with aggregated daily records for each device,
            containing the following columns:
                - timestamp(str): Date (YYYY-MM-DD) representing the aggregation period.
                - device(str): Device identifier.
                - site_id(str): Site identifier.
                - hourly_records(int): Total records for that device on that date.
                - calibrated_records(int): Count of non-null calibrated PM2.5 values.
                - uncalibrated_records(int): Count of missing PM2.5 calibrated values.
                - calibrated_percentage(float): Percentage of calibrated records.
                - uncalibrated_percentage(float): Percentage of uncalibrated records.
        """
        devices_summary = pd.DataFrame()
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data.drop_duplicates(subset=["device", "timestamp"], inplace=True)
        data.index = data["timestamp"]

        for _, by_device in data.groupby("device"):
            for _, by_timestamp in by_device.groupby(
                pd.Grouper(key="timestamp", freq="D")
            ):
                device_data = pd.DataFrame(by_timestamp)
                device_data["timestamp"] = pd.to_datetime(
                    device_data["timestamp"].dt.strftime("%Y-%m-%d")
                )
                device_data["hourly_records"] = int(len(device_data.index))
                device_data["calibrated_records"] = int(
                    device_data.pm2_5_calibrated_value.count()
                )
                device_data["uncalibrated_records"] = int(
                    device_data.pm2_5_calibrated_value.isna().sum()
                )
                device_data["calibrated_percentage"] = (
                    device_data["calibrated_records"] / device_data["hourly_records"]
                ) * 100
                device_data["uncalibrated_percentage"] = (
                    device_data["uncalibrated_records"] / device_data["hourly_records"]
                ) * 100
                device_data = device_data[
                    [
                        "timestamp",
                        "device",
                        "site_id",
                        "hourly_records",
                        "calibrated_records",
                        "uncalibrated_records",
                        "calibrated_percentage",
                        "uncalibrated_percentage",
                    ]
                ]
                device_data["hourly_records"] = device_data["hourly_records"].astype(
                    int
                )
                devices_summary = pd.concat(
                    [devices_summary, device_data], ignore_index=True
                )

        return devices_summary
