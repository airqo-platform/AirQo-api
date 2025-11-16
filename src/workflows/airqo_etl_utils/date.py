from datetime import datetime, timedelta, timezone
from typing import Tuple, Optional, Dict, Any
from dateutil.relativedelta import relativedelta

import logging

from .constants import Frequency

logger = logging.getLogger("airflow.task")


class DateUtils:
    @staticmethod
    def format_datetime_by_unit_str(date: datetime, unit: str) -> str:
        """
        Formats a datetime object into a string based on a specified time boundary using match-case.

        The function supports the following modes:
        - "days_start": Returns the datetime formatted at the start of the day (00:00:00).
        - "days_end": Returns the datetime formatted at the end of the day (23:59:59).
        - "hours_start": Returns the datetime formatted at the start of the hour (minute and second set to 00:00).
        - "hours_end": Returns the datetime formatted at the end of the hour (minute and second set to 59:59).

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
            case _:
                return date.strftime(DAY_START_FORMAT)

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
            if not start_date_time or not end_date_time:
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
                end_date_time, unit + "_end"
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
        execution_date = (
            kwargs["dag_run"].execution_date
            if kwargs.get("dag_run", None)
            else datetime.now(timezone.utc)
        )

        delta = timedelta(days=days) if days else timedelta(hours=hours)
        start_date_time = execution_date - delta
        end_date_time = start_date_time + delta

        return DateUtils.date_to_str(
            start_date_time, str_format="%Y-%m-%dT%H:00:00Z"
        ), DateUtils.date_to_str(end_date_time, str_format="%Y-%m-%dT%H:00:00Z")

    @staticmethod
    def get_utc_offset_for_hour(subject_hour: int) -> int:
        """
        Calculate the time offset (in hours) between the current UTC hour and a given target hour.

        This function compares the current UTC hour with a specified subject hour, and returns the number of hours difference. If the current hour is less than the subject hour, the result is a positive
        offset (how many hours ahead the subject is). If the current hour is greater, the result is negative (how many hours behind the subject is). If both are equal, the offset is zero.

        Args:
            subject_hour (int): The hour of interest (0-23) in 24-hour format.

        Returns:
            int: The UTC offset in hours.
        """
        hour = datetime.now(timezone.utc).hour
        if hour < subject_hour:
            return abs(hour - subject_hour)
        elif hour > subject_hour:
            return subject_hour - hour
        return hour

    @staticmethod
    def str_to_date(
        st: str,
        date_format: Optional[str] = "%Y-%m-%dT%H:%M:%SZ",
        set_utc: Optional[bool] = True,
    ) -> datetime:
        """
        Converts a string to datetime
        Args:
            st(str): Datetime string
            set_utc(bool, optional): Whether to set the timezone to UTC. Defaults to True.
        """
        try:
            dt = datetime.strptime(st, date_format)
        except ValueError:
            dt = datetime.strptime(st, "%Y-%m-%dT%H:%M:%S.%fZ")

        if set_utc:
            dt = dt.replace(tzinfo=timezone.utc)

        return dt

    @staticmethod
    def date_to_str(date: datetime, str_format="%Y-%m-%dT%H:%M:%SZ"):
        """
        Converts datetime to a string
        """
        return datetime.strftime(date, str_format)

    @staticmethod
    def frequency_to_dates(frequency: Frequency) -> Tuple[str, str]:
        """
        Converts frequency to start and end dates and returns the previous or current valid hour/day/week/month based on the frequency.
        Valid meaning that if the current time is 10:15 and frequency is Frequency.HOURLY, it should return 09:00 to 10:00
        Args:
        Returns:
            Tuple[str, str]: A tuple containing the start and end dates as strings in ISO 8601 format with a trailing "Z" indicating UTC.
        Raises:
            ValueError: If the frequency is not recognized.
        """
        now = datetime.now(timezone.utc)
        match frequency:
            case Frequency.HOURLY:
                end_date = now.replace(minute=0, second=0, microsecond=0)
                start_date = end_date - timedelta(hours=1)
            case Frequency.DAILY:
                end_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
                start_date = end_date - timedelta(days=1)
            case Frequency.WEEKLY:
                end_date = now.replace(
                    hour=0, minute=0, second=0, microsecond=0
                ) - timedelta(days=now.weekday())
                start_date = end_date - timedelta(weeks=1)
            case Frequency.MONTHLY:
                end_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                start_date = end_date - relativedelta(months=1)
            case _:
                raise ValueError("Unrecognized frequency")

        return DateUtils.date_to_str(start_date), DateUtils.date_to_str(end_date)
