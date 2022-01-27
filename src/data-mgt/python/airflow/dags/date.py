from datetime import datetime, timedelta


def predict_str_to_date(st: str):
    """
    Converts a predict string to utc datetime
    """

    st = st.replace(' GMT', '')
    date_time = datetime.strptime(st, '%a, %d %b %Y %H:%M:%S')
    date_time = date_time + timedelta(hours=3)
    return date_time


def str_to_date(st: str):
    """
    Converts a string to datetime
    """

    try:
        return datetime.strptime(st, '%Y-%m-%dT%H:%M:%S.%fZ')
    except:
        return datetime.strptime(st, '%Y-%m-%dT%H:%M:%SZ')


def date_to_str(date: datetime):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, '%Y-%m-%dT%H:%M:%SZ')


def date_to_str_hours(date: datetime):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, '%Y-%m-%dT%H:00:00Z')


def first_day_of_month(date_time: datetime):
    return datetime(year=date_time.year, month=date_time.month, day=1)


def last_day_of_month(date_time: datetime):
    month = date_time.month
    if month < 12:
        month = month + 1
        next_month = datetime(year=date_time.year, month=month, day=1)
        return next_month - timedelta(days=1)
    else:
        year = date_time.year + 1
        datetime(year=year, month=1, day=1)


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
    return datetime.strftime(date, '%Y-%m-%dT00:00:00Z')
