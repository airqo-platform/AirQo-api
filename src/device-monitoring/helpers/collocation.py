from datetime import datetime, timedelta

import math

import pandas as pd


class Collocation:
    def __init__(
        self,
        devices: list,
        start_date_time: datetime,
        end_date_time: datetime,
        correlation_threshold: float = 90,
        completeness_threshold: float = 80,
        parameters=None,
    ):

        if parameters is None:
            parameters = [
                "s1_pm2_5",
                "s2_pm2_5",
                "s1_pm10",
                "s2_pm10",
                "internal_temperature",
                "internal_humidity",
                "external_temperature",
                "external_humidity",
            ]

        self.__devices = devices
        self.__correlation_threshold = correlation_threshold / 100
        self.__completeness_threshold = completeness_threshold / 100
        self.__parameters = parameters
        self.__start_date_time = start_date_time
        self.__end_date_time = end_date_time
        self.__data = pd.DataFrame()

        self.__intra_sensor_correlation = pd.DataFrame()
        self.__inter_sensor_correlation = pd.DataFrame()
        self.__data_completeness = pd.DataFrame()
        self.__statistics = pd.DataFrame()
        self.__differences = pd.DataFrame()
        self.__results = {}

    def results(self):
        return self.__results

    def compute_correlation(self):
        if self.__data.empty:
            self.load_device_data()

        self.compute_data_completeness()
        self.compute_inter_sensor_correlation()
        self.compute_intra_sensor_correlation()
        self.compute_statistics()
        self.compute_differences()

        self.__results = {
            "data_completeness": self.__data_completeness.to_dict("records"),
            "statistics": self.__statistics.to_dict("records"),
            "differences": self.__differences.to_dict("records"),
            "intra_sensor_correlation": self.__intra_sensor_correlation.to_dict(
                "records"
            ),
            "inter_sensor_correlation": self.__inter_sensor_correlation.to_dict(
                "records"
            ),
        }

        return self.__results

    def load_device_data(self):
        """
        SELECT
        timestamp, device_number, s1_pm2_5, s2_pm2_5, s1_pm10,
        s2_pm10, device_temperature as internal_temperature, device_humidity as internal_humidity,
        temperature as external_temperature, humidity as external_humidity, altitude, vapor_pressure
        FROM `airqo-250220.averaged_data.hourly_device_measurements`
        WHERE DATE(timestamp) >= "2023-01-15" and
        device_id in UNNEST(["aq_g5_38", "aq_g519", "aq_g5_63"])
        """

        # query = ""
        #
        # dataframe = self.client.query(query=query).result().to_dataframe()
        #
        # if dataframe.empty:
        #     return pd.DataFrame()
        #
        # dataframe["timestamp"] = dataframe["timestamp"].apply(pd.to_datetime)
        #
        # return dataframe.drop_duplicates(keep="first")
        self.__data = pd.read_json(
            "/Users/noah/airqo/AirQo-api/src/device-monitoring/collocation_test_data.json"
        )
        return self.__data

    def compute_intra_sensor_correlation(self) -> pd.DataFrame:
        """
        Compute correlation of a device
        inputs: data (Columns => device, parameters)
        parameters: []
        outputs:
            device | pm2_5_pearson_correlation | pm10_pearson_correlation | r2 | s1_pm2_5 | s2_pm2_5 | s1_pm10 | s2_pm10

        Steps:
        1. For each device, Use pandas to compute pm2.5 and pm 10 pearson correlation
            pd.correlation()
            NB: Take note of null values.
        2. For each device, Compute r2 => square pm2_5_pearson_correlation => r2

        """
        correlation = []
        group_by_device_number = self.__data.groupby("device_number")
        for _, device_group in group_by_device_number:
            device_number = device_group.iloc[0].device_number
            pm2_5_pearson_correlation = (
                self.__data[["s1_pm2_5", "s2_pm2_5"]].corr().round(4)
            )
            pm10_pearson_correlation = (
                self.__data[["s1_pm10", "s2_pm10"]].corr().round(4)
            )
            correlation.append(
                {
                    "device_number": device_number,
                    "pm2_5_pearson_correlation": pm2_5_pearson_correlation.iloc[0][
                        "s2_pm2_5"
                    ],
                    "pm10_pearson_correlation": pm10_pearson_correlation.iloc[0][
                        "s2_pm10"
                    ],
                    "pm2_5_r2": math.sqrt(
                        pm2_5_pearson_correlation.iloc[0]["s2_pm2_5"]
                    ),
                    "pm10_r2": pm10_pearson_correlation.iloc[0]["s2_pm10"],
                    "passed": pm2_5_pearson_correlation.iloc[0]["s2_pm2_5"]
                    > self.__correlation_threshold,
                }
            )
        self.__intra_sensor_correlation = pd.DataFrame(correlation)
        return self.__intra_sensor_correlation

    def compute_data_completeness(self):
        """
        Docs: https://docs.google.com/document/d/1RrHfHmRrxYGFtkMFyeBlbba8jmqmsFGI1QYsEaJcMLk/edit
        inputs:
            a list of devices,
            start date
            expected number of records in an hour
            number of days
            end date?
            completeness_threshold? : 0 - 100 (default value 80)
            -----------
            end date => end date is null ?? start date + number of days

        outputs: Dataframe
         device | % completeness | % missing | expected_records | hourly_actual_records_count | recommendation

        Steps:
        1. Querying tha data from the API or data warehouse
            user devices, start date, end date
            NB: remove duplicates (timestamp, device_number or name)
                Use hourly data
        2. Calculate number of expected records in the period for all devices. 24 * number of days (expected)
        3. Calculate number of Hourly Actual records that we sent by each device (actual)
        4. Compute completeness for each device => (actual/expected )* 100 (completeness)
        5. Compute Missing for each device => 100 - completeness (Missing)
        6. Compute Recommendation => Passed if completeness > completenessThreshold else Failed
        """

        completeness_report = []
        data = self.__data.drop_duplicates(subset=["device_number", "timestamp"])
        expected_records = 24 * (self.__end_date_time - self.__start_date_time).days

        group_by_device_number = data.groupby("device_number")
        for _, device_group in group_by_device_number:
            actual_number_of_records = len(device_group.index)
            completeness = actual_number_of_records / expected_records
            missing = 1 - completeness
            passed = completeness > self.__completeness_threshold
            device_number = device_group.iloc[0].device_number

            completeness_report.append(
                {
                    "device_number": device_number,
                    "expected_number_of_records": expected_records,
                    "actual_number_of_records": actual_number_of_records,
                    "completeness": completeness,
                    "missing": missing,
                    "passed": passed,
                }
            )
        self.__data_completeness = pd.DataFrame(completeness_report)
        return self.__data_completeness

    def compute_statistics(self):

        """
        Ref : https://docs.google.com/document/d/14Lli_xCeCq1a1JM2JkbCuF2FSqX3BtqkacxQWs9HCPc/edit#heading=h.3jnb6ajjwl2
        Compute correlation of a device
        inputs: data (Columns => device, s1_pm2_5 , s2_pm2_5 , s1_pm10 , s2_pm10, battery_voltage,
                        internal_temperature, internal_humidity and external_humidity, altitude, external_pressure
                        and external_temperature )
        outputs:
            device and  (mean, std, max, min) for s1_pm2_5, s2_pm2_5, s1_pm10 and s2_pm10, battery_voltage,
            internal  and external temperature, internal and external humidity, altitude, external pressure

        Steps:
        1. For each device, compute the statistics

        """

        statistics = []
        group_by_device_number = self.__data.groupby("device_number")
        for _, device_group in group_by_device_number:

            device_number = device_group.iloc[0].device_number
            device_statistics = {}

            for col in self.__parameters:
                col_statistics = device_group[col].describe()
                device_statistics = {
                    **device_statistics,
                    **{
                        f"{col}_mean": col_statistics["mean"],
                        f"{col}_std": col_statistics["std"],
                        f"{col}_min": col_statistics["min"],
                        f"{col}_max": col_statistics["max"],
                        f"{col}_25_percentile": col_statistics["25%"],
                        f"{col}_50_percentile": col_statistics["50%"],
                        f"{col}_75_percentile": col_statistics["75%"],
                    },
                }

            statistics.append({**{"device_number": device_number}, **device_statistics})
        self.__statistics = pd.DataFrame(statistics)
        return self.__statistics

    def compute_inter_sensor_correlation(self):

        """
        Compute correlation between devices
        inputs: statistics (device, s1_pm2_5 | s2_pm2_5 | s1_pm10 | s2_pm10, external_humidity, internal_humidity)
        outputs:
            a dataframe with the correlated data

        Steps:
        Use pandas to compute the correlation
        """
        correlation = []
        device_pairs = self.device_pairs(self.__data)

        for device_pair in device_pairs:

            device_x_data = self.__data[self.__data["device_number"] == device_pair[0]]
            device_x_data = device_x_data.add_prefix(f"{device_pair[0]}_")
            device_x_data.rename(
                columns={f"{device_pair[0]}_timestamp": "timestamp"}, inplace=True
            )

            device_y_data = self.__data[self.__data["device_number"] == device_pair[1]]
            device_y_data = device_y_data.add_prefix(f"{device_pair[1]}_")
            device_y_data.rename(
                columns={f"{device_pair[1]}_timestamp": "timestamp"}, inplace=True
            )

            device_pair_data = pd.merge(
                left=device_x_data,
                right=device_y_data,
                on=["timestamp"],
                how="left",
            )

            device_pair_correlation_map = {}

            for col in self.__parameters:
                cols = [f"{device_pair[0]}_{col}", f"{device_pair[1]}_{col}"]
                device_pair_correlation = device_pair_data[cols].corr().round(4)
                device_pair_correlation_map[col] = device_pair_correlation.iloc[0][
                    cols[1]
                ]

            correlation.append(
                {
                    **{
                        "devices": "_and_".join([str(s) for s in device_pair]),
                    },
                    **device_pair_correlation_map,
                    **{
                        "passed": device_pair_correlation_map["s1_pm2_5"]
                        > self.__correlation_threshold,
                    },
                }
            )
        self.__inter_sensor_correlation = pd.DataFrame(correlation)
        return self.__inter_sensor_correlation

    @staticmethod
    def device_pairs(data: pd.DataFrame) -> list:
        devices = list(set(data["device_number"].tolist()))
        device_pairs = []
        for device_x in devices:
            for device_y in devices:
                if (device_x == device_y) or ((device_y, device_x) in device_pairs):
                    continue
                device_pairs.append([device_x, device_y])

        return device_pairs

    def compute_differences(self) -> pd.DataFrame:

        """
        Computes differences
        inputs: statistics
        outputs:
            differences

        Steps:
        1. Use pandas to compute the differences
        """
        differences = []

        data = self.__statistics

        if data.empty:
            data = self.compute_statistics()

        device_pairs = self.device_pairs(data)

        for device_pair in device_pairs:

            device_x_data = data[data["device_number"] == device_pair[0]]
            device_x_data = device_x_data.add_prefix(f"{device_pair[0]}_")
            device_x_data = device_x_data.reset_index()

            device_y_data = data[data["device_number"] == device_pair[1]]
            device_y_data = device_y_data.add_prefix(f"{device_pair[1]}_")
            device_y_data = device_y_data.reset_index()

            device_pair_data = pd.merge(
                device_x_data, device_y_data, left_index=True, right_index=True
            )
            differences_map = {}

            for col in data.columns.to_list():
                if col == "device_number":
                    continue
                cols = [f"{device_pair[0]}_{col}", f"{device_pair[1]}_{col}"]

                device_pair_data[col] = (
                    device_pair_data[cols[0]] - device_pair_data[cols[1]]
                )

                differences_map[col] = device_pair_data.iloc[0][col]

            differences.append(
                {
                    **{
                        "devices": "_and_".join([str(s) for s in device_pair]),
                    },
                    **differences_map,
                }
            )

        self.__differences = pd.DataFrame(differences)
        return self.__differences


if __name__ == "__main__":
    collocation = Collocation(
        devices=[],
        start_date_time=datetime.now() - timedelta(days=4),
        end_date_time=datetime.now(),
    )

    collocation.compute_correlation()
    results = collocation.results()
    print(results)
