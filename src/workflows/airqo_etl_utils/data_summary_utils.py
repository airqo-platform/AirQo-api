import pandas as pd


class DataSummaryUtils:
    @staticmethod
    def compute_devices_summary(data: pd.DataFrame) -> pd.DataFrame:
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
