from datetime import datetime, timedelta, timezone


class DateUtils:
    day_start_date_time_format = "%Y-%m-%dT00:00:00Z"
    day_end_date_time_format = "%Y-%m-%dT11:59:59Z"
    hour_date_time_format = "%Y-%m-%dT%H:00:00Z"

    @staticmethod
    def date_to_str(date: datetime, str_format):
        return datetime.strftime(date, str_format)

    @staticmethod
    def get_dag_date_time_values(
        historical: bool = False,
        days: int = None,
        hours: int = None,  
        **kwargs,
    ):
        try:
            is_manual_run = (
                kwargs["dag_run"].external_trigger if "dag_run" in kwargs else False
            )
            print("KWARGS:", kwargs)
            print("IS MANUAL RUN:", is_manual_run)
            if historical and is_manual_run:
                start_date_time = kwargs.get("params", {}).get("start_date_time")
                end_date_time = kwargs.get("params", {}).get("end_date_time")
            else:
                dag_run = kwargs.get("dag_run")
                print("DAG RUN:", dag_run)
                start_date_time = dag_run.conf["start_date_time"]
                end_date_time = dag_run.conf["end_date_time"]
        except Exception as e:
            print("Exception in get_dag_date_time_values", repr(e))
            if hours is not None:
                start_date_time = datetime.now(timezone.utc) - timedelta(hours=hours)
                end_date_time = start_date_time + timedelta(hours=hours)
                start_date_time = DateUtils.date_to_str(
                    start_date_time, DateUtils.hour_date_time_format
                )
                end_date_time = DateUtils.date_to_str(
                    end_date_time, DateUtils.hour_date_time_format
                )
            elif days is not None:
                start_date_time = datetime.now(timezone.utc) - timedelta(days=days)
                end_date_time = start_date_time + timedelta(days=days)
                start_date_time = DateUtils.date_to_str(
                    start_date_time, DateUtils.day_start_date_time_format
                )
                end_date_time = DateUtils.date_to_str(
                    end_date_time, DateUtils.day_end_date_time_format
                )
            else:
                start_date_time = datetime.now(timezone.utc) - timedelta(days=1)
                end_date_time = datetime.now(timezone.utc)
                start_date_time = DateUtils.date_to_str(    
                    start_date_time, DateUtils.day_start_date_time_format
                )
                end_date_time = DateUtils.date_to_str(
                    end_date_time, DateUtils.day_end_date_time_format
                )

        print("START DATE TIME:", start_date_time)
        print("END DATE TIME:", end_date_time)
        return start_date_time, end_date_time

    @staticmethod
    def get_query_date_time_values(hours=1, days=0):
        start_date_time = datetime.now(timezone.utc) - timedelta(hours=hours)
        end_date_time = start_date_time + timedelta(hours=hours)

        if days != 0:
            start_date_time = datetime.now(timezone.utc) - timedelta(days=days)
            end_date_time = start_date_time + timedelta(days=days)

        return date_to_str_hours(start_date_time), date_to_str_hours(end_date_time)


def get_utc_offset_for_hour(subject_hour: int) -> int:
    hour = datetime.now(timezone.utc).hour
    if hour < subject_hour:
        return abs(hour - subject_hour)
    elif hour > subject_hour:
        return subject_hour - hour
    return hour


def predict_str_to_date(st: str) -> datetime:
    """
    Converts a predict string to utc datetime
    """

    st = st.replace(" GMT", "")
    date_time = datetime.strptime(st, "%a, %d %b %Y %H:%M:%S")
    date_time = date_time.replace(tzinfo=timezone.utc) + timedelta(hours=3)
    return date_time


def str_to_date(st: str, date_format="%Y-%m-%dT%H:%M:%SZ") -> datetime:
    """
    Converts a string to a timezone-aware datetime object set to UTC.
    """

    try:
        return datetime.strptime(st, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.strptime(st, date_format).replace(tzinfo=timezone.utc)


def date_to_str(date: datetime, str_format="%Y-%m-%dT%H:%M:%SZ") -> str:
    """
    Converts datetime to a string
    """
    return date.strftime(str_format)


def date_to_str_hours(date: datetime) -> str:
    """
    Converts datetime to a string
    """
    return date.strftime("%Y-%m-%dT%H:00:00Z")


def str_to_str_hours(dateStr: str) -> str:
    """
    Converts string to a string hours
    """
    date = str_to_date(dateStr)
    return date_to_str_hours(date)


def str_to_str_days(dateStr: str) -> str:
    """
    Converts string to a string days
    """
    date = str_to_date(dateStr)
    return date_to_str_days(date)


def str_to_str_default(dateStr: str) -> str:
    """
    Converts string to a string dafault
    """
    date = str_to_date(dateStr)
    return date_to_str(date)


def frequency_time(dateStr: str, frequency: str) -> str:
    """
    Converts string to a specific frequency time format.
    """
    if frequency.lower() == "hourly":
        return str_to_str_hours(dateStr=dateStr)
    elif frequency.lower() == "daily":
        return str_to_str_days(dateStr=dateStr)
    else:
        return str_to_str_default(dateStr=dateStr)


def first_day_of_month(date_time: datetime) -> datetime:
    """
    Returns the first day of the month for the given datetime.
    """
    return date_time.replace(day=1)


def last_day_of_month(date_time: datetime) -> datetime:
    """
    Returns the last day of the month for the given datetime.
    """
    next_month = date_time.replace(day=28) + timedelta(days=4)
    return next_month - timedelta(days=next_month.day)

def first_day_of_week(date_time: datetime) -> datetime:
    """
    Returns the first day of the week (Monday) for the given datetime.
    """
    start_of_week = date_time - timedelta(days=date_time.weekday())
    return start_of_week


def last_day_of_week(date_time: datetime) -> datetime:
    """
    Returns the last day of the week (Sunday) for the given datetime.
    """
    end_of_week = date_time + timedelta(days=(6 - date_time.weekday()))
    return end_of_week


def date_to_str_days(date: datetime):
    """
    Converts datetime to a string
    """
    return date.strftime("%Y-%m-%dT00:00:00Z")
