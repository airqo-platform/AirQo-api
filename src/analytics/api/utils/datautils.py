import numpy as np
import pandas as pd
from pathlib import Path
from typing import List, Dict, Any, Union, Tuple, Optional
import ast

from api.models.bigquery_api import BigQueryApi
from config import BaseConfig as Config

from constants import (
    DeviceCategory,
    DeviceNetwork,
    Frequency,
    DataType,
)


import logging

logger = logging.getLogger(__name__)


class DataUtils:
    @staticmethod
    def extract_data_from_bigquery(
        datatype: DataType,
        start_date_time: str,
        end_date_time: str,
        frequency: Frequency,
        device_category: DeviceCategory,
        device_network: Optional[DeviceNetwork] = None,
        dynamic_query: Optional[bool] = False,
        columns: List[str] = None,
        data_filter: Optional[Dict[str, Any]] = None,
        use_cache: Optional[bool] = False,
    ) -> pd.DataFrame:
        """
        Extracts data from BigQuery within a specified time range and frequency,
        with an optional filter for the device network. The data is cleaned to remove outliers.

        Args:
            datatype(DataType): The type of data to extract determined by the source data asset i.e raw, calibrated.
            start_date_time(str): The start of the time range for data extraction, in ISO 8601 format.
            end_date_time(str): The end of the time range for data extraction, in ISO 8601 format.
            frequency(Frequency): The frequency of the data to be extracted, e.g., RAW or HOURLY.
            device_network(DeviceNetwork, optional): The network to filter devices, default is None (no filter).
            dynamic_query(bool, optional): Determines the type of data returned. If True, returns averaged data grouped by `device_number`, `device_id`, and `site_id`. If False, returns raw data without aggregation. Defaults to False.
            columns(List, optional): Columns of interest i.e those that should be returned.
            data_filter(Dict, optional): A column filter with it's values i.e {"device_id":["aq_001", "aq_002"]}
            use_cach(bool, optional): Use biqquery cache

        Returns:
            pd.DataFrame: A pandas DataFrame containing the cleaned data from BigQuery.

        Raises:
            ValueError: If the frequency is unsupported or no table is associated with it.
        """
        table: str = None
        sorting_cols: List[str] = ["site_id", "device_name"]
        bigquery_api = BigQueryApi()
        data_table_freq = frequency
        if not device_category:
            device_category = DeviceCategory.LOWCOST

        datasource = Config.data_sources()

        if dynamic_query:
            # Temporary fix for raw data downloads. This only works for the /data-download endpoint and allow it to download raw data from the average table.
            # TODO Come up with permanent solutions.
            datatype = DataType.CALIBRATED
            frequency = Frequency.HOURLY if frequency == Frequency.RAW else frequency

        if data_table_freq.value in {"weekly", "monthly", "yearly"}:
            data_table_freq = Frequency.HOURLY

        table = datasource.get(datatype).get(device_category).get(data_table_freq)

        if not table:
            logger.exception(
                f"Wrong table information provided: {datatype}, {device_category}, {frequency}"
            )
            raise ValueError("No table information provided.")

        raw_data = bigquery_api.query_data(
            table=table,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            network=device_network,
            frequency=frequency,
            data_type=datatype,
            columns=columns,  # Columns of interest i.e pollutants
            where_fields=data_filter,
            dynamic_query=dynamic_query,
            use_cache=use_cache,
        )

        expected_columns = bigquery_api.get_columns(table=table)
        if raw_data.empty:
            return pd.DataFrame(columns=expected_columns)

        drop_columns = ["device_name"]
        if frequency.value in {"weekly", "monthly", "yearly"}:
            frequency_ = frequency.value[:-2]
            drop_columns.append(frequency_)
            sorting_cols.append(frequency_)
        else:
            drop_columns.append("datetime")
            sorting_cols.append("datetime")

        if dynamic_query and datatype.value == "raw":
            # This currently being used for data downloads and not the raw-data endpoint
            DataUtils.drop_zero_rows_and_columns_data_cleaning(raw_data)
        elif dynamic_query:
            raw_data.drop_duplicates(subset=drop_columns, inplace=True, keep="first")
            raw_data.sort_values(sorting_cols, ascending=True, inplace=True)

        raw_data["frequency"] = frequency.value
        raw_data = raw_data.replace(np.nan, None)

        return raw_data

    @classmethod
    def drop_zero_rows_and_columns_data_cleaning(
        cls, data: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Perform data cleaning on a pandas DataFrame to handle specific conditions
        related to "pm2_5" and "pm2_5_raw_value" columns.

        The cleaning process includes:
        1. Ensuring correct numeric data types for "pm2_5" and "pm2_5_raw_value".
        2. Removing "pm2_5" values where "pm2_5_raw_value" values are not 0s.
        3. Dropping the "pm2_5_raw_value" column if all its values are 0s.
        4. Retaining "pm2_5" values where "pm2_5_raw_value" values are all 0s.
        5. Dropping any column (including "pm2_5" and "pm2_5_raw_value") if all values are 0s.

        Args:
            cls: Class reference (used in classmethods).
            data (pd.DataFrame): Input pandas DataFrame with "pm2_5" and
                                "pm2_5_raw_value" columns.

        Returns:
            pd.DataFrame: Cleaned DataFrame with updates applied in place.

        Raises:
            ValueError: If "pm2_5" or "pm2_5_raw_value" columns are missing.
        """
        required_numeric_columns = ["pm2_5", "pm2_5_raw_value"]

        missing_columns = [
            col for col in required_numeric_columns if col not in data.columns
        ]
        if missing_columns:
            raise ValueError(f"Missing required columns: {missing_columns}")

        data[required_numeric_columns] = data[required_numeric_columns].apply(
            pd.to_numeric, errors="coerce"
        )

        data.loc[data["pm2_5_raw_value"] != 0, "pm2_5"] = np.nan

        if ((data["pm2_5_raw_value"] == 0) | (data["pm2_5_raw_value"].isna())).all():
            data.drop(columns=["pm2_5_raw_value"], inplace=True)

        zero_columns = data.loc[:, (data == 0).all()].columns
        data.drop(columns=zero_columns, inplace=True)
        data.dropna(how="all", axis=1, inplace=True)

        return data
