from datetime import datetime, timedelta


class DateUtils:
    @staticmethod
    def get_gad_date_time_values(interval_in_days: int = 1, **kwargs):
        try:
            dag_run = kwargs.get("dag_run")
            start_date_time = dag_run.conf["start_date_time"]
            end_date_time = dag_run.conf["end_date_time"]
        except KeyError:
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=interval_in_days)
            start_date_time = datetime.strftime(start_date, "%Y-%m-%dT00:00:00Z")
            end_date_time = datetime.strftime(end_date, "%Y-%m-%dT11:59:59Z")

        return start_date_time, end_date_time

    @staticmethod
    def get_realtime_date_time_values():
        hour_of_day = datetime.utcnow() - timedelta(hours=1)
        start_date_time = date_to_str_hours(hour_of_day)
        end_date_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")
        return start_date_time, end_date_time


def get_utc_offset_for_hour(subject_hour: int) -> int:
    hour = datetime.utcnow().hour
    if hour < subject_hour:
        return abs(hour - subject_hour)
    elif hour > subject_hour:
        return subject_hour - hour
    return hour


def predict_str_to_date(st: str):
    """
    Converts a predict string to utc datetime
    """

    st = st.replace(" GMT", "")
    date_time = datetime.strptime(st, "%a, %d %b %Y %H:%M:%S")
    date_time = date_time + timedelta(hours=3)
    return date_time


def str_to_date(st: str):
    """
    Converts a string to datetime
    """

    try:
        return datetime.strptime(st, "%Y-%m-%dT%H:%M:%S.%fZ")
    except:
        return datetime.strptime(st, "%Y-%m-%dT%H:%M:%SZ")


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


def str_to_str_hours(dateStr: str) -> str:
    """
    Converts string to a string hours
    """
    date = str_to_date(dateStr)
    return date_to_str_hours(date)


def str_to_date_to_str(date_str: str) -> str:
    """
    Converts string to a string hours
    """
    date = str_to_date(date_str)
    return date_to_str(date)


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
    if frequency.lower() == "hourly":
        return str_to_str_hours(dateStr=dateStr)
    elif frequency.lower() == "daily":
        return str_to_str_days(dateStr=dateStr)
    else:
        return str_to_str_default(dateStr=dateStr)


def first_day_of_month(date_time: datetime) -> datetime:
    return datetime(year=date_time.year, month=date_time.month, day=1)


def last_day_of_month(date_time: datetime) -> datetime:
    month = date_time.month
    if month < 12:
        month = month + 1
        next_month = datetime(year=date_time.year, month=month, day=1)
        return next_month - timedelta(days=1)
    else:
        year = date_time.year + 1
        next_month = datetime(year=year, month=1, day=1)
        return next_month - timedelta(days=1)


def first_day_of_week(date_time: datetime):
    if date_time.weekday() != 0:
        offset = abs(0 - date_time.weekday())
        return date_time - timedelta(days=offset)
    else:
        return date_time


def last_day_of_week(date_time: datetime):
    if date_time.weekday() != 6:
        offset = 6 - date_time.weekday()
        return date_time + timedelta(days=offset)
    else:
        return date_time


def date_to_str_days(date: datetime):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, "%Y-%m-%dT00:00:00Z")
