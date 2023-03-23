from enum import Enum

import numpy as np
from datetime import datetime, timedelta
from google.cloud import bigquery

import math

import pandas as pd
from app import cache

from config.constants import Config
from helpers.convert_dates import date_to_str, validate_date
from models import BaseModel


class CollocationStatus(Enum):
    SCHEDULED = 1
    RUNNING = 2
    PASSED = 3
    FAILED = 4
    COMPLETED = 5

    def __str__(self) -> str:
        if self == self.SCHEDULED:
            return "scheduled"
        elif self == self.RUNNING:
            return "running"
        elif self == self.PASSED:
            return "passed"
        elif self == self.FAILED:
            return "failed"
        elif self == self.COMPLETED:
            return "completed"
        else:
            return ""


class CollocationScheduling(BaseModel):
    def __init__(
        self,
    ):
        super().__init__("airqo", "collocation")

    def __get_running_records(self):
        results = self.db.collocation.find(
            {
                "start_date": {"$lte": datetime.utcnow()},
                "end_date": {"$gte": datetime.utcnow()},
            }
        )
        return results

    def __get_scheduled_records(self):
        results = self.db.collocation.find(
            {
                "scheduled_date": {"$lte": datetime.utcnow()},
                "status": str(CollocationStatus.SCHEDULED),
            }
        )
        return results

    def __replace_record(self, record_id, data):
        self.db.collocation.replace_one(
            {
                "_id": record_id,
            },
            data,
        )
        # self.db.collocation.delete_many(
        #     {
        #         "start_date": data["start_date"],
        #         "end_date": data["end_date"],
        #         "devices": data["devices"],
        #     }
        # )

    def run_scheduled_collocated_devices(self):
        results = self.__get_scheduled_records()
        for result in results:
            data = dict(result)
            devices = data.get("devices")
            start_date = data.get("start_date")
            end_date = data.get("end_date")
            completeness_threshold = data.get("completeness_threshold")
            expected_records_per_day = data.get("expected_records_per_day")
            correlation_threshold = data.get("correlation_threshold")
            added_by = data.get("added_by")
            record_id = data.get("_id")

            collocation = Collocation(
                devices=list(set(devices)),
                start_date=start_date,
                end_date=end_date,
                correlation_threshold=correlation_threshold,
                completeness_threshold=completeness_threshold,
                parameters=None,  # Temporarily disabled parameters
                expected_records_per_day=expected_records_per_day,
                verbose=True,
                added_by=added_by,
            )
            collocation_results = collocation.collocate()
            if len(collocation_results) != 0:
                self.__replace_record(record_id, collocation_results)

    def update_scheduled_status(self):
        results = self.__get_running_records()
        for result in results:
            data = dict(result)
            record_id = data.pop("_id")
            data["status"] = str(CollocationStatus.RUNNING)
            self.__replace_record(record_id, data)


def validate_collocation_request(
    completeness_threshold,
    correlation_threshold,
    expected_records_per_day,
    devices,
    start_date,
    end_date,
) -> dict:
    errors = {}
    try:
        if not (0 <= completeness_threshold <= 1):
            raise Exception
    except Exception:
        errors["completenessThreshold"] = f"Must be a value between 0 and 1"

    try:
        if not (0 <= correlation_threshold <= 1):
            raise Exception
    except Exception:
        errors["correlationThreshold"] = f"Must be a value between 0 and 1"

    try:
        if not (1 <= expected_records_per_day <= 24):
            raise Exception
    except Exception:
        errors["expectedRecordsPerDay"] = f"Must be a value between 1 and 24"

    try:
        if not devices or not isinstance(
            devices, list
        ):  # TODO add device restrictions e.g not more that 3 devices
            raise Exception
    except Exception:
        errors["devices"] = "Provide a list of devices"

    try:
        start_date = validate_date(start_date)
    except Exception:
        errors["startDate"] = (
            "This query param is required."
            "Please provide a valid date formatted datetime string (%Y-%m-%d)"
        )

    try:
        end_date = validate_date(end_date)
    except Exception:
        errors["endDate"] = (
            "This query param is required."
            "Please provide a valid date formatted datetime string (%Y-%m-%d)"
        )

    if (
        start_date > end_date
    ):  # TODO add interval restrictions e.g not more that 10 days
        errors["dates"] = "endDate must be greater or equal to the startDate"

    return errors


def get_status(passed: bool):
    if passed:
        return "passed"

    return "failed"


class Collocation(BaseModel):
    @staticmethod
    def valid_parameters():
        return [
            "s1_pm2_5",
            "s2_pm2_5",
            "s1_pm10",
            "s2_pm10",
            "internal_temperature",
            "internal_humidity",
            "external_temperature",
            "external_humidity",
            "battery_voltage",
        ]

    def __init__(
        self,
        devices: list,
        start_date: datetime,
        end_date: datetime,
        correlation_threshold: float,
        completeness_threshold: float,
        expected_records_per_day: int,
        added_by: dict,
        verbose: bool = False,
        parameters: list = None,
    ):
        super().__init__("airqo", "collocation")

        if parameters is None:
            parameters = self.valid_parameters()
        self.__client = bigquery.Client()
        self.__raw_data_table = f"`{Config.BIGQUERY_RAW_DATA}`"
        self.__devices = devices
        self.__correlation_threshold = correlation_threshold
        self.__completeness_threshold = completeness_threshold
        self.__expected_records_per_day = expected_records_per_day
        self.__parameters = parameters
        self.__start_date = start_date
        self.__end_date = end_date
        self.__verbose = verbose

        self.__data = pd.DataFrame()
        self.__intra_sensor_correlation = pd.DataFrame()
        self.__inter_sensor_correlation = pd.DataFrame()
        self.__data_completeness = pd.DataFrame()
        self.__statistics = pd.DataFrame()
        self.__differences = pd.DataFrame()
        self.__summary = pd.DataFrame()
        self.__data_query = ""
        self.__results = {}
        self.__added_by = added_by
        self.__errors = []

    def __save_collocation(self, results):
        return self.db.collocation.insert_one(results.copy())

    def summary(self):
        if self.__start_date and self.__end_date:
            results = self.db.collocation.find(
                {
                    "start_date": self.__start_date,
                    "end_date": self.__end_date,
                }
            ).sort("date_added", -1)
        else:
            results = self.db.collocation.find().sort("date_added", -1)

        documents = list(results)
        summary = []

        for document in documents:
            status = document.get("status", "")
            added_by = f'{document.get("added_by", {}).get("first_name", "")} {document.get("added_by", {}).get("last_name", "")}'
            if status == "running" or status == "scheduled":
                for device in document.get("devices", []):
                    summary.append(
                        {
                            "device_name": device,
                            "added_by": added_by,
                            "start_date": document.get("start_date"),
                            "end_date": document.get("end_date"),
                            "status": document.get("status"),
                            "passed_intra_sensor_correlation": False,
                            "passed_data_completeness": False,
                            "date_added": document.get("date_added"),
                        }
                    )

            elif status == "completed":
                doc_summary = list(document.get("summary", []))
                summary.extend(doc_summary)

        return summary

    def get_collocation_results(self):
        results = self.results()

        data_completeness = []
        intra_sensor_correlation = []
        inter_sensor_correlation = []
        self.__load_device_data()
        data = self.__data
        data = data.replace(np.nan, None)
        if results.get("status", "") != str(CollocationStatus.COMPLETED):
            self.compute_data_completeness()
            data_completeness = self.__data_completeness.to_dict("records")
        else:
            devices_data_completeness = list(
                filter(
                    lambda x: x["device_name"] in self.__devices,
                    results.get("data_completeness", []),
                )
            )
            for device_data_completeness in devices_data_completeness:
                data_completeness.append(
                    {
                        **device_data_completeness,
                        **{
                            "start_date": results.get("start_date"),
                            "end_date": results.get("end_date"),
                        },
                    }
                )

        for device in self.__devices:
            device_data = data[data["device_name"] == device]
            correlation_data = device_data.copy()
            data_groups = correlation_data.set_index("timestamp", drop=False).groupby(
                pd.Grouper(freq="D")
            )
            device_intra_sensor_correlation = {"device_name": device, "data": []}
            device_inter_sensor_correlation = {"device_name": device, "data": []}

            for _, group in data_groups:
                if group.empty:
                    continue
                device_inter_sensor_correlation["data"].extend(group.to_dict("records"))

                timestamp = group.iloc[0]["timestamp"]
                pm2_5_pearson_correlation = (
                    group[["s1_pm2_5", "s2_pm2_5"]].corr().round(4)
                )
                pm10_pearson_correlation = group[["s1_pm10", "s2_pm10"]].corr().round(4)
                device_intra_sensor_correlation["data"].append(
                    {
                        "timestamp": date_to_str(
                            timestamp, str_format="%Y-%m-%dT%H:00:00.000000Z"
                        ),
                        "pm2_5_pearson_correlation": pm2_5_pearson_correlation.iloc[0][
                            "s2_pm2_5"
                        ],
                        "pm10_pearson_correlation": pm10_pearson_correlation.iloc[0][
                            "s2_pm10"
                        ],
                        "pm2_5_r2": math.sqrt(
                            pm2_5_pearson_correlation.iloc[0]["s2_pm2_5"]
                        ),
                        "pm10_r2": math.sqrt(
                            pm10_pearson_correlation.iloc[0]["s2_pm10"]
                        ),
                    }
                )
            intra_sensor_correlation.append(device_intra_sensor_correlation)
            inter_sensor_correlation.append(device_inter_sensor_correlation)

        return {
            "data_completeness": data_completeness,
            "intra_sensor_correlation": intra_sensor_correlation,
            "inter_sensor_correlation": inter_sensor_correlation,
        }

    def results(self):
        if len(self.__devices) == 1:
            results = self.db.collocation.find_one(
                {
                    "start_date": self.__start_date,
                    "end_date": self.__end_date,
                    "devices": {"$in": self.__devices},
                }
            )
        else:
            results = self.db.collocation.find_one(
                {
                    "start_date": self.__start_date,
                    "end_date": self.__end_date,
                    "devices": self.__devices,
                }
            )

        if results is None:
            return {}

        data = dict(results)
        data.pop("_id")
        return data

    def __create_results_object(self, status: CollocationStatus):
        return {
            "devices": self.__devices,
            "start_date": self.__start_date,
            "end_date": self.__end_date,
            "correlation_threshold": self.__correlation_threshold,
            "completeness_threshold": self.__completeness_threshold,
            "expected_records_per_day": self.__expected_records_per_day,
            "added_by": self.__added_by,
            "date_added": datetime.utcnow(),
            "status": str(status),
            "scheduled_date": self.__end_date + timedelta(hours=2),
            "data_completeness": self.__data_completeness.to_dict("records"),
            "summary": self.__summary.to_dict("records"),
            "statistics": self.__statistics.to_dict("records"),
            "differences": self.__differences.to_dict("records"),
            "intra_sensor_correlation": self.__intra_sensor_correlation.to_dict(
                "records"
            ),
            "inter_sensor_correlation": self.__inter_sensor_correlation.to_dict(
                "records"
            ),
            "errors": self.__errors,
            "data_source": self.__data_query,
        }

    def schedule(self):
        results = self.db.collocation.find_one(
            {
                "start_date": self.__start_date,
                "end_date": self.__end_date,
                "devices": {"$in": self.__devices},
            }
        )

        if results:
            del results["_id"]
            return results

        results = self.__create_results_object(status=CollocationStatus.SCHEDULED)
        self.__save_collocation(results)
        return results

    def collocate(self):
        self.__load_device_data()

        if not self.__data.empty:
            self.__aggregate_data()
            self.compute_data_completeness()
            self.compute_inter_sensor_correlation()
            self.compute_intra_sensor_correlation()
            self.compute_statistics()
            self.compute_differences()
            self.compute_summary()

            self.__data_completeness = self.__data_completeness.replace(np.nan, None)
            self.__statistics = self.__statistics.replace(np.nan, None)
            self.__intra_sensor_correlation = self.__intra_sensor_correlation.replace(
                np.nan, None
            )
            self.__inter_sensor_correlation = self.__inter_sensor_correlation.replace(
                np.nan, None
            )
            self.__differences = self.__differences.replace(np.nan, None)
            self.__summary = self.__summary.replace(np.nan, None)

            return self.__create_results_object(status=CollocationStatus.COMPLETED)

        return {}

    def __aggregate_data(self) -> pd.DataFrame:
        data = self.__data
        aggregated_data = pd.DataFrame()
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)

        for _, group in data.groupby("device_name"):
            device_name = group.iloc[0]["device_name"]
            del group["device_name"]

            averages = group.resample("1H", on="timestamp").mean()
            averages["timestamp"] = averages.index
            averages["device_name"] = device_name

            aggregated_data = pd.concat([aggregated_data, averages], ignore_index=True)

        self.__data = aggregated_data
        return self.__data

    @cache.memoize()
    def query_data(self, query):
        dataframe = self.__client.query(query=query).result().to_dataframe()

        if dataframe.empty:
            return pd.DataFrame()

        dataframe["timestamp"] = dataframe["timestamp"].apply(pd.to_datetime)
        dataframe.drop_duplicates(
            subset=["timestamp", "device_id"], keep="first", inplace=True
        )
        dataframe.rename(columns={"device_id": "device_name"}, inplace=True)

        self.__data = dataframe
        return self.__data

    def __load_device_data(self):
        """
        SELECT
        timestamp, device_name, s1_pm2_5, s2_pm2_5, s1_pm10,
        s2_pm10, device_temperature as internal_temperature, device_humidity as internal_humidity,
        temperature as external_temperature, humidity as external_humidity, altitude, vapor_pressure
        FROM `airqo-250220.averaged_data.hourly_device_measurements`
        WHERE DATE(timestamp) >= "2023-01-15" and
        device_name in UNNEST(["aq_g5_38", "aq_g519", "aq_g5_63"])
        """

        col_mappings = {
            "s1_pm2_5": "s1_pm2_5",
            "s2_pm2_5": "s2_pm2_5",
            "s1_pm10": "s1_pm10",
            "s2_pm10": "s2_pm10",
            "internal_temperature": "device_temperature as internal_temperature",
            "internal_humidity": "device_humidity as internal_humidity",
            "external_temperature": "temperature as external_temperature",
            "external_humidity": "humidity as external_humidity",
            "battery_voltage": "battery as battery_voltage",
        }
        cols = []
        for parameter in self.__parameters:
            if parameter in col_mappings.keys():
                cols.append(col_mappings[parameter])

        query = (
            f" SELECT timestamp, device_id, {', '.join(map(str, set(cols)))} "
            f" FROM {self.__raw_data_table} "
            f" WHERE {self.__raw_data_table}.timestamp >= '{date_to_str(self.__start_date, str_format='%Y-%m-%d')}' "
            f" AND {self.__raw_data_table}.timestamp <= '{date_to_str(self.__end_date, str_format='%Y-%m-%d')}' "
            f" AND device_id IN UNNEST({self.__devices}) "
        )

        self.__data_query = query

        dataframe = self.__client.query(query=query).result().to_dataframe()

        if dataframe.empty:
            self.__errors.append(
                f"{', '.join(self.__devices)} dont have data between {self.__start_date} and {self.__end_date}"
            )
            return

        devices = dataframe["device_id"].tolist()
        devices_without_data = set(self.__devices).difference(set(devices))

        if len(devices_without_data) != 0:
            error = f"{', '.join(devices_without_data) } does not have data between {self.__start_date} and {self.__end_date}"
            if len(devices_without_data) > 1:
                error = f"{devices_without_data} dont have data between {self.__start_date} and {self.__end_date}"
            self.__errors.append(error)
            return

        dataframe["timestamp"] = dataframe["timestamp"].apply(pd.to_datetime)
        dataframe.drop_duplicates(
            subset=["timestamp", "device_id"], keep="first", inplace=True
        )
        dataframe.rename(columns={"device_id": "device_name"}, inplace=True)

        self.__data = dataframe
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
        device_groups = self.__data.groupby("device_name")
        for _, group in device_groups:
            device_name = group.iloc[0].device_name
            pm2_5_pearson_correlation = (
                self.__data[["s1_pm2_5", "s2_pm2_5"]].corr().round(4)
            )
            pm10_pearson_correlation = (
                self.__data[["s1_pm10", "s2_pm10"]].corr().round(4)
            )
            correlation.append(
                {
                    "device_name": device_name,
                    "pm2_5_pearson_correlation": pm2_5_pearson_correlation.iloc[0][
                        "s2_pm2_5"
                    ],
                    "pm10_pearson_correlation": pm10_pearson_correlation.iloc[0][
                        "s2_pm10"
                    ],
                    "pm2_5_r2": math.sqrt(
                        pm2_5_pearson_correlation.iloc[0]["s2_pm2_5"]
                    ),
                    "pm10_r2": math.sqrt(pm10_pearson_correlation.iloc[0]["s2_pm10"]),
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
            NB: remove duplicates (timestamp, device_name or name)
                Use hourly data
        2. Calculate number of expected records in the period for all devices. 24 * number of days (expected)
        3. Calculate number of Hourly Actual records that we sent by each device (actual)
        4. Compute completeness for each device => (actual/expected )* 100 (completeness)
        5. Compute Missing for each device => 100 - completeness (Missing)
        6. Compute Recommendation => Passed if completeness > completenessThreshold else Failed
        """

        completeness_report = []
        data = self.__data.drop_duplicates(subset=["device_name", "timestamp"])
        date_diff = (self.__end_date - self.__start_date).days
        expected_records = (
            self.__expected_records_per_day
            if date_diff <= 0
            else self.__expected_records_per_day * date_diff
        )

        device_groups = data.groupby("device_name")
        for _, group in device_groups:
            actual_number_of_records = len(group.index)
            completeness = 1
            missing = 0

            if actual_number_of_records < expected_records:
                completeness = actual_number_of_records / expected_records
                missing = 1 - completeness

            completeness_report.append(
                {
                    "device_name": group.iloc[0].device_name,
                    "expected_number_of_records": expected_records,
                    "actual_number_of_records": actual_number_of_records,
                    "completeness": completeness,
                    "missing": missing,
                    "passed": completeness > self.__completeness_threshold,
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
        device_groups = self.__data.groupby("device_name")
        for _, group in device_groups:
            device_name = group.iloc[0].device_name
            device_statistics = {}

            for col in self.__parameters:
                col_statistics = group[col].describe()
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

            statistics.append({**{"device_name": device_name}, **device_statistics})
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
            device_x_data = self.__data[self.__data["device_name"] == device_pair[0]]
            device_x_data = device_x_data.add_prefix(f"{device_pair[0]}_")
            device_x_data.rename(
                columns={f"{device_pair[0]}_timestamp": "timestamp"}, inplace=True
            )

            device_y_data = self.__data[self.__data["device_name"] == device_pair[1]]
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

            device_pair_correlation = {}

            for col in self.__parameters:
                cols = [f"{device_pair[0]}_{col}", f"{device_pair[1]}_{col}"]
                device_pair_correlation_data = device_pair_data[cols].corr().round(4)
                device_pair_correlation[col] = device_pair_correlation_data.iloc[0][
                    cols[1]
                ]

            correlation.append(
                {
                    **{
                        "devices": device_pair,
                    },
                    **device_pair_correlation,
                    **{
                        "passed": device_pair_correlation["s1_pm2_5"]
                        > self.__correlation_threshold,
                    },
                }
            )
        self.__inter_sensor_correlation = pd.DataFrame(correlation)
        return self.__inter_sensor_correlation

    @staticmethod
    def device_pairs(data: pd.DataFrame) -> list:
        devices = list(set(data["device_name"].tolist()))
        device_pairs = []
        for device_x in devices:
            for device_y in devices:
                if (device_x == device_y) or ((device_y, device_x) in device_pairs):
                    continue
                device_pairs.append([device_x, device_y])

        return device_pairs

    def compute_summary(self) -> pd.DataFrame:
        """
        Computes summary
        """

        data = pd.merge(
            left=self.__data_completeness,
            right=self.__intra_sensor_correlation,
            on="device_name",
            suffixes=("_data_completeness", "_intra_sensor_correlation"),
        )

        data["status"] = (
            data["passed_data_completeness"] & data["passed_intra_sensor_correlation"]
        )
        data["status"] = data["status"].apply(lambda x: get_status(x))
        data["start_date"] = self.__start_date
        data["end_date"] = self.__end_date
        data[
            "added_by"
        ] = f"{self.__added_by.get('first_name', '')} {self.__added_by.get('last_name', '')}".strip()

        self.__summary = data[
            [
                "status",
                "start_date",
                "end_date",
                "device_name",
                "added_by",
                "passed_intra_sensor_correlation",
                "passed_data_completeness",
            ]
        ]

        return self.__summary

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
            device_x_data = data[data["device_name"] == device_pair[0]]
            device_x_data = device_x_data.add_prefix(f"{device_pair[0]}_")
            device_x_data = device_x_data.reset_index()

            device_y_data = data[data["device_name"] == device_pair[1]]
            device_y_data = device_y_data.add_prefix(f"{device_pair[1]}_")
            device_y_data = device_y_data.reset_index()

            device_pair_data = pd.merge(
                device_x_data, device_y_data, left_index=True, right_index=True
            )
            differences_map = {}

            for col in data.columns.to_list():
                if col == "device_name":
                    continue
                cols = [f"{device_pair[0]}_{col}", f"{device_pair[1]}_{col}"]

                device_pair_data[col] = (
                    device_pair_data[cols[0]] - device_pair_data[cols[1]]
                )

                differences_map[col] = abs(device_pair_data.iloc[0][col])

            differences.append(
                {
                    **{
                        "devices": device_pair,
                    },
                    **differences_map,
                }
            )

        self.__differences = pd.DataFrame(differences)
        return self.__differences
