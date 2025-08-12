import numpy as np
import pandas as pd
from typing import List, Dict, Any, Set, Optional

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
        main_columns: List[str] = None,
        data_filter: Optional[Dict[str, Any]] = None,
        extra_columns: Optional[Dict[str, Any]] = None,
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
            main_columns(List, optional): Columns of interest i.e those that should be returned.
            data_filter(Dict, optional): A column filter with it's values i.e {"device_id":["aq_001", "aq_002"]}
            use_cach(bool, optional): Use biqquery cache

        Returns:
            pd.DataFrame: A pandas DataFrame containing the cleaned data from BigQuery.

        Raises:
            ValueError: If the frequency is unsupported or no table is associated with it.
        """
        table: str = None
        sorting_cols: List[str] = ["device_name"]
        bigquery_api = BigQueryApi()
        datatype_ = datatype
        data_table_freq = frequency

        datasource = Config.data_sources()

        if data_table_freq.value in {"weekly", "monthly", "yearly"}:
            data_table_freq = Frequency.DAILY

        table = datasource.get(datatype_).get(device_category).get(data_table_freq)

        if not table:
            logger.exception(
                f"Wrong table information provided: {datatype}, {device_category}, {frequency}"
            )
            raise ValueError("No table information provided.")

        raw_data = bigquery_api.query_data(
            table=table,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=device_category,
            network=device_network,
            frequency=frequency,
            data_type=datatype,
            columns=main_columns,  # Columns of interest i.e pollutants
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
            sorting_cols.append(frequency_)
        else:
            drop_columns.append("datetime")
            sorting_cols.append("datetime")

        if dynamic_query:
            # This currently being used for the data-downloads endpoint only
            raw_data = DataUtils.drop_zero_rows_and_columns_data_cleaning(
                raw_data, datatype, main_columns
            )
            raw_data.sort_values(sorting_cols, ascending=True, inplace=True)

            raw_data = DataUtils.drop_unnecessary_columns_data_cleaning(
                raw_data, extra_columns, device_category
            )
            raw_data.drop_duplicates(subset=drop_columns, inplace=True, keep="first")

        raw_data["frequency"] = frequency.value
        raw_data = raw_data.replace(np.nan, None)

        return raw_data

    @classmethod
    def drop_zero_rows_and_columns_data_cleaning(
        cls, data: pd.DataFrame, datatype: DataType, pollutants: List[str]
    ) -> pd.DataFrame:
        """
        Cleans the input DataFrame by:
        - Casting numeric columns to floats.
        - Conditionally replacing values based on data type and network.
        - Dropping columns with only zeros or NaNs.
        - Dropping rows where all required columns are NaN.

        Specifically for 'raw' data:
        - Replaces 'pm2_5' values with NaN where all pollutant_raw_value columns are > 0.
        - Drops pollutant_raw_value columns if they contain only 0s or NaNs.

        Args:
            data(pd.DataFrame): Input air quality DataFrame.
            datatype(DataType): Indicates if the dataset is 'raw' or another type.
            pollutants(List[str]): List of pollutant names, e.g., ["pm2_5", "pm10"].

        Returns:
            pd.DataFrame: Cleaned DataFrame.

        Raises:
            ValueError: If required numeric columns are missing.
        """
        required_columns = set(data.select_dtypes(include="number").columns)

        # TODO: Clean or delete this functionality
        if datatype == DataType.RAW:
            networks = data["network"].unique().tolist()
            if "airqo" not in networks or len(networks) > 1:
                required_columns.add("pm2_5")
            # raw_value_columns = [f"{pollutant}_raw_value" for pollutant in pollutants]
            # required_columns.update(raw_value_columns)
        # else:
        #     raw_value_columns = []

        missing = [col for col in required_columns if col not in data.columns]
        if missing:
            raise ValueError(f"Missing required numeric columns: {missing}")

        # Ensure all relevant columns are numeric (coerce bad values to NaN)
        data[list(required_columns)] = data[list(required_columns)].apply(
            pd.to_numeric, errors="coerce"
        )

        # if raw_value_columns:
        #     # For mixed device data
        #     condition = data[raw_value_columns].gt(0).all(axis=1)
        #     data.loc[condition, "pm2_5"] = np.nan

        #     drop_mask = data[raw_value_columns].isna() | (data[raw_value_columns] == 0)
        #     drop_mask = drop_mask.all()
        #     columns_to_drop = drop_mask[drop_mask].index.tolist()
        #     if columns_to_drop:
        #         data.drop(columns=columns_to_drop, inplace=True)

        zero_only_columns = data.columns[(data == 0).all()]
        data.drop(columns=zero_only_columns, inplace=True)

        return data

    @classmethod
    def drop_unnecessary_columns_data_cleaning(
        cls, data: pd.DataFrame, extra_columns: List[str], device_category
    ) -> pd.DataFrame:
        """
        Drops unnecessary columns from the given DataFrame during data cleaning.

        If extra_columns is empty, all optional fields are dropped.
        Otherwise, only optional fields not in extra_columns are dropped.

        Args:
            cls: Class reference (used to access Config).
            data (pd.DataFrame): Input DataFrame to clean.
            extra_columns (List[str]): List of optional fields to keep.

        Returns:
            pd.DataFrame: The cleaned DataFrame with unnecessary columns dropped.

        Note: This method fails silently.
        """
        optional_fields: Set[str] = Config.OPTIONAL_FIELDS.get(device_category)

        if not extra_columns:
            data.drop(
                columns=optional_fields.union({"site_id", "timestamp"}),
                errors="ignore",
                inplace=True,
            )
        else:
            columns_to_drop = optional_fields.union({"site_id", "timestamp"}) - set(
                extra_columns
            )
            data.drop(columns=list(columns_to_drop), errors="ignore", inplace=True)

        return data
