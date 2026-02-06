from typing import Dict, List, Dict, Any, Optional, Union, Tuple
from api.utils.cursor_utils import CursorUtils
from constants import (
    Frequency,
    DataType,
    DeviceCategory,
)
import pandas as pd

from .responses import ResponseBuilder
from api.utils.datautils import DataUtils
from api.utils.data_formatters import (
    format_to_aqcsv,
)


class DownloadService:
    def __init__(self):
        pass

    @staticmethod
    def _parse_enum(enum_cls, value: str, param_name: str):
        """Helper to safely parse string values to Enumerations"""
        try:
            return enum_cls[value.upper()]
        except KeyError:
            raise ValueError(f"Invalid {param_name}: {value!r}")

    @staticmethod
    def fetch_data(
        json_data: Dict[str, Any], filter_type: str, filter_value: Union[str, int]
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Extracts time-series environmental data from BigQuery based on user-defined filters.

        Args:
            json_data (Dict[str, Any]): Dictionary containing query parameters such as:
                - "startDateTime": str (ISO timestamp)
                - "endDateTime": str (ISO timestamp)
                - "datatype": Optional[str] (e.g., "raw", "calibrated")
                - "frequency": Optional[str] (e.g., "hourly", "daily")
                - "device_category": Optional[str] (e.g., "LOWCOST", "BAM")
                - "pollutants": Optional[List[str]]
                - "metaDataFields": Optional[List[str]]
                - "weatherFields": Optional[List[str]]
            filter_type(str): Field name to apply filtering on (e.g., "site_id", "device_id").
            filter_value(Union[str, int]): Value to match for the given filter_type.

        Returns:
            pd.DataFrame: A DataFrame containing the filtered environmental data with specified pollutants and additional metadata/weather columns.

        Raises:
            ValueError: If an invalid data type, frequency, or device category is provided.
        """
        start = json_data["startDateTime"]
        end = json_data["endDateTime"]
        extra_columns = json_data.get("metaDataFields", []) + json_data.get(
            "weatherFields", []
        )
        pollutants = json_data.get("pollutants", [])
        query_type = json_data.get("dynamic", False)
        cursor_token = json_data.get("cursor", None)

        try:
            if cursor_token and not CursorUtils.validate_cursor(cursor_token):
                raise ValueError("Invalid or expired cursor token")
            elif cursor_token:
                cursor_metadata = CursorUtils.parse_cursor(cursor_token)
                start = cursor_metadata["timestamp"]
        except Exception as e:
            raise ValueError(f"Error validating cursor token: {e}")

        data_type = DownloadService._parse_enum(
            DataType, json_data.get("datatype", "calibrated"), "data type"
        )
        frequency = DownloadService._parse_enum(
            Frequency, json_data.get("frequency", "daily"), "frequency"
        )
        device_category = DownloadService._parse_enum(
            DeviceCategory,
            json_data.get("device_category", "lowcost"),
            "device category",
        )
        results, metadata = DataUtils.extract_data_from_bigquery(
            datatype=data_type,
            start_date_time=start,
            end_date_time=end,
            frequency=frequency,
            dynamic_query=query_type,
            device_category=device_category,
            main_columns=pollutants,
            data_filter={filter_type: filter_value},
            extra_columns=extra_columns,
            use_cache=True,
            cursor_token=cursor_token,
        )
        if not results.empty:
            results.rename(columns={"device_id": "device_name"}, inplace=True)
        return results, metadata

    @staticmethod
    def format_csv_records(
        records: List[Dict[str, Any]],
        pollutants: List[str],
        frequency: Frequency,
        format_type: str,
    ) -> List[Dict[str, Any]]:
        """
        Formats environmental sensor records into a target CSV-compatible structure.

        Args:
            records (List[Dict[str, Any]]): Raw data records fetched from the backend.
            pollutants (List[str]): List of pollutant keys to include in formatting.
            frequency (Frequency): Enum representing the data sampling frequency.
            format_type (str): Target output format (e.g., "aqcsv").

        Returns:
            List[Dict[str, Any]]: Formatted records ready for CSV export or download.
        """
        if format_type == "aqcsv":
            return format_to_aqcsv(
                data=records, frequency=frequency, pollutants=pollutants
            )
        return records

    @staticmethod
    def cast_for_json_serialization(df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Casts DataFrame columns to strings if they contain types that are not JSON serializable.

        Args:
            df (pd.DataFrame): The DataFrame to process.

        Returns:
            List[Dict[str, Any]]: Formatted records ready for json export or download.
        """
        serializable_dtypes = ["int64", "float64", "bool", "object"]
        non_serializable_columns = df.select_dtypes(exclude=serializable_dtypes).columns
        df[non_serializable_columns] = df[non_serializable_columns].astype(str)
        df = df.to_dict("records")
        return df

    @staticmethod
    def format_and_respond(
        json_data: Dict[str, Any],
        data_frame: pd.DataFrame,
        metadata: Optional[Dict[str, Any]] = {},
    ) -> Union[Tuple[Dict[str, Any], int], Any]:
        """
        Formats the retrieved data and returns the appropriate response.

        Args:
            json_data: The validated request JSON.
            data_frame: The data to return.

        Returns:
            A JSON response or CSV file response.
        """
        download_type = json_data.get("downloadType", "json")
        output_format = json_data.get("outputFormat", "json")
        frequency = Frequency[json_data["frequency"].upper()]
        pollutants = json_data.get("pollutants", [])

        if download_type == "json":
            records = DownloadService.cast_for_json_serialization(data_frame)
            return ResponseBuilder.success(
                records, metadata, "Data download successful"
            )

        records: List[Dict[str, Any]] = data_frame.to_dict("records")

        if output_format == "aqcsv":
            records = format_to_aqcsv(
                data=records, frequency=frequency, pollutants=pollutants
            )

        postfix = "-" if output_format == "airqo-standard" else "-aqcsv-"
        file_name = f"{frequency}-air-quality{postfix}data"
        return ResponseBuilder.csv(records, file_name)
