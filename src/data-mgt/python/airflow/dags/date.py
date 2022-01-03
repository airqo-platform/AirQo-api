from datetime import datetime, timedelta


def date_to_formatted_str(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, '%Y-%m-%d %H:%M')


def predict_str_to_date(st):
    """
    Converts a predict string to utc datetime
    """

    st = str(st).replace(' GMT', '')
    date_time = datetime.strptime(st, '%a, %d %b %Y %H:%M:%S')
    date_time = date_time + timedelta(hours=3)
    return date_time


def str_to_date(st):
    """
    Converts a string to datetime
    """
    return datetime.strptime(st, '%Y-%m-%dT%H:%M:%S.%fZ')


def date_to_str(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, '%Y-%m-%dT%H:%M:%SZ')


def date_to_str_hours(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, '%Y-%m-%dT%H:00:00Z')


def date_to_str_days(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, '%Y-%m-%dT00:00:00Z')


def date_to_str_hours_daily(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, '%Y-%m-%d') + "T23:59:00Z"


def generate_datetime(date, time):
    if date is None or date == "":
        return None
    else:
        if time is None or time == "":
            time = "00:00"
        date_time = date + "T" + time + ":00Z"
        return date_time
