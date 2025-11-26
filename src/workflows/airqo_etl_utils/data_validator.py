from itertools import chain
import logging
import numpy as np
import pandas as pd
import ast
from typing import Optional, Dict, List, Any
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.constants import ColumnDataType
from .config import configuration as Config

logger = logging.getLogger("airflow.task")


class DataValidationUtils:
    @staticmethod
    def format_data_types(
        data: pd.DataFrame,
        floats: Optional[List] = None,
        integers: Optional[List] = None,
        timestamps: Optional[List] = None,
        records: Optional[List] = None,
        repeated: Optional[List] = None,
    ) -> pd.DataFrame:
        """
        Formats specified columns in a DataFrame to desired data types: float, integer, and datetime.

        Args:
            data(pd.DataFrame): The input DataFrame containing the data to be formatted.
            floats(list, optional): List of column names to be converted to floats. Defaults to an empty list.
            integers(list, optional): List of column names to be converted to integers. Defaults to an empty list.
            timestamps(list, optional): List of column names to be converted to datetime. Defaults to an empty list.
            records(list, optional): List of column names to be converted to records. Defaults to an empty list.
            repeated(list, optional): List of column names to be converted to repeated fields. Defaults to an empty list.

        Returns:
            pd.DataFrame: A DataFrame with the specified columns formatted to their respective data types.

        Notes:
        ------
        - Columns specified in `floats` are converted to floats. Rows with invalid values are coerced to NaN.
        - Columns specified in `integers` are stripped of non-numeric characters, and invalid values are replaced with -1.
        - Columns specified in `timestamps` are converted to datetime. Invalid timestamps are coerced to NaT.
        - The function modifies the input DataFrame in place and returns it.
        """

        floats = floats or []
        integers = integers or []
        timestamps = timestamps or []
        records = records or []
        repeated = repeated or []
        if floats:
            data[floats] = data[floats].apply(pd.to_numeric, errors="coerce")

        if timestamps:
            for col in timestamps:
                """
                Normalize timestamp formats to standardized ISO 8601 format with milliseconds.

                Transformation steps applied via single regex pattern:
                1. Extract date part: YYYY-MM-DD
                2. Handle both 'T' and space separators between date and time
                3. Extract time part: HH:MM:SS
                4. Remove fractional seconds (microseconds) if present: (?:\.\d+)?
                5. Capture timezone indicator: +HH:MM or Z
                6. Reconstruct as: YYYY-MM-DD HH:MM:SS.000Z
                - Uses space separator (not T) for consistency
                - Adds .000 milliseconds if missing
                - Standardizes timezone to Z (UTC)

                Examples:
                    '2025-08-25 07:57:15.968000+00:00' → '2025-08-25 07:57:15.000Z'
                    '2025-08-12 00:00:00+00:00'        → '2025-08-12 00:00:00.000Z'
                    '2025-11-04T22:07:20Z'             → '2025-11-04 22:07:20.000Z'
                    '2025-10-20 09:27:06.123+00:00'    → '2025-10-20 09:27:06.000Z'

                Regex breakdown:
                    (\d{4}-\d{2}-\d{2})     - Group 1: Date (YYYY-MM-DD)
                    [T ]                     - Match 'T' or space separator
                    (\d{2}:\d{2}:\d{2})     - Group 2: Time (HH:MM:SS)
                    (?:\.\d+)?              - Non-capturing: optional fractional seconds (removed)
                    (\+\d{2}:\d{2}|Z)       - Group 3: Timezone (+00:00 or Z) - discarded in output
                """
                data[col] = (
                    data[col]
                    .astype(str)
                    .str.strip("*,")  # Remove leading/trailing *, comma, period
                    .str.replace(
                        r"(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.\d+)?(\+\d{2}:\d{2}|Z)",
                        lambda m: f"{m.group(1)} {m.group(2)}.000Z",
                        regex=True,
                    )
                )
                data[col] = pd.to_datetime(data[col], errors="coerce", utc=True)

        if integers:
            for col in integers:
                data[col] = (
                    pd.to_numeric(
                        data[col]
                        .fillna("")
                        .astype(str)
                        .str.strip()
                        .replace("", np.nan),
                        errors="coerce",
                    )
                    .fillna(-1)
                    .astype(np.int64)
                )
        if records:
            for col in records:
                data[col] = data[col].apply(DataValidationUtils._convert_record)

        if repeated:
            for col in repeated:
                data[col] = data[col].apply(
                    DataValidationUtils._convert_repeated_record
                )
        return data

    @staticmethod
    def _convert_repeated_record(value: Any) -> List[Dict] | None:
        """
        Converts a value to a list of dictionaries suitable for BigQuery REPEATED RECORD.

        Args:
            value: The value to convert (can be list, string representation, None, etc.)

        Returns:
            List[Dict] | None: Properly formatted list of dictionaries or None.
        """

        if value is None:
            return None

        if isinstance(value, str):
            try:
                parsed = ast.literal_eval(value)
                if isinstance(parsed, list):
                    if all(isinstance(item, dict) for item in parsed):
                        return parsed
            except Exception as e:
                logger.error(f"Error parsing repeated record: {e}")
        return None

    @staticmethod
    def _convert_record(value: Any) -> Dict | None:
        """
        Converts a value to a dictionary suitable for BigQuery RECORD.

        Args:
            value: The value to convert (can be dict, string representation, None, etc.)

        Returns:
            Dict | None: Properly formatted dictionary or None.
        """

        if value is None:
            return None

        if isinstance(value, str):
            try:
                parsed = ast.literal_eval(value)
                if isinstance(parsed, list):
                    return parsed
            except Exception as e:
                logger.error(f"Error parsing record: {e}")
        return None

    @staticmethod
    def get_valid_value(
        data: pd.DataFrame, validated_columns: List[str]
    ) -> pd.DataFrame:
        """
        Validates and cleans the specified columns in a DataFrame by replacing out-of-range values with None based on predefined valid ranges per column.

        Args:
            data(pd.DataFrame): The input DataFrame containing sensor data.
            validated_columns(List[str]): List of column names to validate.

        Returns:
            pd.DataFrame: The DataFrame with validated columns, where values outside the allowed range are replaced with None.
        """
        for col in validated_columns:
            mapped_name = Config.AIRQO_DATA_COLUMN_NAME_MAPPING.get(col, None)
            valid_range = Config.VALID_SENSOR_RANGES.get(mapped_name, None)
            if valid_range is None:
                continue

            min_val, max_val = valid_range

            data[col] = pd.to_numeric(data[col], errors="coerce")

            mask = (data[col] >= min_val) & (data[col] <= max_val)
            data[col] = data[col].where(mask, other=None)

        return data

    @staticmethod
    def remove_outliers_fix_types(
        data: pd.DataFrame, remove_outliers: Optional[bool] = True
    ) -> pd.DataFrame:
        """
        Cleans and validates data in a DataFrame by formatting columns to their proper types and removing or correcting outliers based on predefined validation rules.

        Args:
            data (pd.DataFrame): Input DataFrame containing the raw data to clean.

        Returns:
            pd.DataFrame: A DataFrame with outliers removed or corrected and data formatted to their respective types (float, integer, timestamp).
        """
        # TODO: Clean up and remove direct use of BigQueryApi in this method to enhance modularity and testability.
        # Consider passing necessary metadata as parameters instead.
        big_query_api = BigQueryApi()

        column_types = {
            ColumnDataType.FLOAT: big_query_api.get_columns(
                table="all", column_type=[ColumnDataType.FLOAT]
            ),
            ColumnDataType.INTEGER: big_query_api.get_columns(
                table="all", column_type=[ColumnDataType.INTEGER]
            ),
            ColumnDataType.TIMESTAMP: big_query_api.get_columns(
                table="all", column_type=[ColumnDataType.TIMESTAMP]
            ),
        }

        filtered_columns = {
            dtype: list(set(columns) & set(data.columns))
            for dtype, columns in column_types.items()
        }
        if remove_outliers:
            validated_columns = list(chain.from_iterable(filtered_columns.values()))
            data = DataValidationUtils.get_valid_value(data, validated_columns)

        # Fix data types after filling nas
        data = DataValidationUtils.format_data_types(
            data=data,
            floats=filtered_columns[ColumnDataType.FLOAT],
            integers=filtered_columns[ColumnDataType.INTEGER],
            timestamps=filtered_columns[ColumnDataType.TIMESTAMP],
        )
        return data

    @staticmethod
    def fill_missing_columns(data: pd.DataFrame, cols: list) -> pd.DataFrame:
        """
        Ensures that all specified columns exist in the given DataFrame. If a column is missing, it is added to the DataFrame with `None` as its default value.

        Args:
            data (pd.DataFrame): The input DataFrame to check and update.
            cols (list): A list of column names to ensure exist in the DataFrame.

        Returns:
            pd.DataFrame: The updated DataFrame with all specified columns present.

        Logs:
            Warns if a column in the `cols` list is missing from the DataFrame.
        """
        data_cols = data.columns.to_list()
        for column in cols:
            if column not in data_cols:
                logger.warning(f"{column} missing in dataset")
                data[column] = None
        return data
