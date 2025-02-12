from datetime import datetime, timedelta, timezone
from typing import Tuple, Optional, Dict, Any

import logging

logger = logging.getLogger(__name__)


class DateUtils:
    day_start_date_time_format: str = "%Y-%m-%dT00:00:00Z"
    day_end_date_time_format: str = "%Y-%m-%dT11:59:59Z"
    hour_date_time_format: str = "%Y-%m-%dT%H:00:00Z"
    hour_end_date_time_format: str = "%Y-%m-%dT%H:59:59Z"

    @staticmethod
    def date_to_str(date: datetime, unit: Optional[str] = None) -> str:
        """
        Returns a string formatted datetime.
        """
        day_start_date_time_format: str = "%Y-%m-%dT00:00:00Z"
        day_end_date_time_format: str = "%Y-%m-%dT11:59:59Z"
        hour_date_time_format: str = "%Y-%m-%dT%H:00:00Z"
        hour_end_date_time_format: str = "%Y-%m-%dT%H:59:59Z"

        date_str: str = ""
        if unit == "hours":
            date_str = datetime.strftime(date, hour_date_time_format)
        elif unit == "days":
            date_str = datetime.strftime(date, day_start_date_time_format)
        else:
            date_str = datetime.strftime(date, day_end_date_time_format)
        return date_str

    def format_datetime_by_unit_str(date: datetime, unit: str) -> str:
        """
        Formats a datetime object into a string based on a specified time boundary using match-case.

        The function supports the following modes:
        - "day_start": Returns the datetime formatted at the start of the day (00:00:00).
        - "day_end": Returns the datetime formatted at the end of the day (23:59:59).
        - "hour_start": Returns the datetime formatted at the start of the hour (minute and second set to 00:00).
        - "hour_end": Returns the datetime formatted at the end of the hour (minute and second set to 59:59).

        If the unit is not provided or does not match one of the expected values, the function defaults to "day_end".

        Args:
            date (datetime): The datetime object to format.
            unit (Optional[str]): The desired time boundary for formatting. Valid values are "day_start",
                                "day_end", "hour_start", and "hour_end". Defaults to None.

        Returns:
            str: The formatted datetime string in ISO 8601 format with a trailing "Z" indicating UTC.
        """
        DAY_START_FORMAT = "%Y-%m-%dT00:00:00Z"
        DAY_END_FORMAT = "%Y-%m-%dT23:59:59Z"
        HOUR_START_FORMAT = "%Y-%m-%dT%H:00:00Z"
        HOUR_END_FORMAT = "%Y-%m-%dT%H:59:59Z"

        match unit:
            case "days_start":
                return date.strftime(DAY_START_FORMAT)
            case "days_end":
                return date.strftime(DAY_END_FORMAT)
            case "hours_start":
                return date.strftime(HOUR_START_FORMAT)
            case "hours_end":
                return date.strftime(HOUR_END_FORMAT)

    @staticmethod
    def get_dag_date_time_values(
        days: Optional[int] = None,
        hours: Optional[int] = None,
        **kwargs: Dict[str, Any],
    ) -> Tuple[str, str]:
        """
        Formats start and end dates.

        Args:
            - days(Optional): Number of days in the past to consider.
            - hours(Optional): Number of hours in the past to consider.
            - **kwargs: Extra arguments to pass. Usually from the airflow context.

        Returns:
            A tuple of string formatted dates
        """
        exception_occurred: bool = False
        unit: str = "hours" if hours else "days"
        value: int = hours if hours else (days if days else 1)
        delta_kwargs = {unit: value}
        dag_run = kwargs.get("dag_run", None)
        is_manual_run = dag_run.external_trigger if dag_run else False
        logger.info(f"KWARGS:, {kwargs}")
        logger.info(f"IS MANUAL RUN: {is_manual_run}")

        if is_manual_run:
            start_date_time = kwargs.get("params", {}).get("start_date_time")
            end_date_time = kwargs.get("params", {}).get("end_date_time")
            if not start_date_time or not start_date_time:
                try:
                    logger.info("DAG RUN:", dag_run)
                    start_date_time = dag_run.conf["start_date_time"]
                    end_date_time = dag_run.conf["end_date_time"]
                except Exception as e:
                    exception_occurred = True
                    logger.exception(f"Exception in get_dag_date_time_values", {e})

        if not is_manual_run or exception_occurred:
            execution_date = (
                dag_run.execution_date if dag_run else datetime.now(timezone.utc)
            )
            delta = timedelta(**delta_kwargs)
            start_date_time = execution_date - delta
            end_date_time = execution_date

            start_date_time = DateUtils.format_datetime_by_unit_str(
                start_date_time, unit + "_start"
            )
            end_date_time = DateUtils.format_datetime_by_unit_str(
                start_date_time, unit + "_end"
            )

        return start_date_time, end_date_time

    @staticmethod
    def get_query_date_time_values(
        hours: Optional[int] = 1, days: Optional[int] = 0, **kwargs: Dict[str, Any]
    ) -> Tuple[str, str]:
        """
        Calculates query start and end datetime values based on the DAG run's execution date.

        This function determines the time window for querying data. If the `days` parameter is non-zero,
        the time window is computed using days; otherwise, the `hours` parameter is used. The start datetime
        is computed by subtracting the appropriate delta from the execution date, and the end datetime is computed
        by adding the same delta to the start datetime. The final datetimes are formatted as strings using
        the `date_to_str_hours` function.

        Args:
            hours(int, optional): The number of hours to use for the time window when `days` is zero. Defaults to 1.
            days(int, optional): The number of days to use for the time window. If non-zero, this value overrides `hours`. Defaults to 0.
            **kwargs: Additional keyword arguments. Expected to contain a "dag_run" key with an `execution_date` attribute.

        Returns:
            tuple: A tuple containing two strings:
                - The formatted start datetime.
                - The formatted end datetime.
        """
        execution_date = kwargs["dag_run"].execution_date

        delta = timedelta(days=days) if days else timedelta(hours=hours)
        start_date_time = execution_date - delta
        end_date_time = start_date_time + delta

        return date_to_str_hours(start_date_time), date_to_str_hours(end_date_time)


def get_utc_offset_for_hour(subject_hour: int) -> int:
    hour = datetime.now(timezone.utc).hour
    if hour < subject_hour:
        return abs(hour - subject_hour)
    elif hour > subject_hour:
        return subject_hour - hour
    return hour


def str_to_date(st: str, date_format="%Y-%m-%dT%H:%M:%SZ"):
    """
    Converts a string to datetime
    """

    try:
        return datetime.strptime(st, "%Y-%m-%dT%H:%M:%S.%fZ")
    except:
        return datetime.strptime(st, date_format)


def date_to_str(date: datetime, str_format="%Y-%m-%dT%H:%M:%SZ"):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, str_format)


def date_to_str_hours(date: datetime):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, "%Y-%m-%dT%H:00:00Z")


def date_to_str_days(date: datetime):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, "%Y-%m-%dT00:00:00Z")
