from datetime import datetime, timedelta


def str_to_date(st, str_format='%Y-%m-%dT%H:%M:%S.%fZ'):
    """
    Converts a string to datetime
    """
    return datetime.strptime(st, str_format)


def date_to_str(date, str_format='%Y-%m-%dT%H:%M:%S.%fZ'):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, str_format)


def format_date(date: datetime, str_format='%Y-%m-%dT%H:%M:%S.%fZ'):
    st = date.strftime(str_format)
    return datetime.strptime(st, str_format)

def convert_GMT_time_to_EAT_local_time(gmt_datetime):
    """
     converts a datetime object in GMT to East African Local Time and formats it to a string value.
    """
    return datetime.strftime(gmt_datetime + timedelta(hours=3), '%a, %d %b %Y %H:%M %p')

def convert_to_date(gmt_datetime):
    return datetime.strftime(gmt_datetime, '%Y-%m-%d')


def validate_datetime(value) -> datetime:
    try:
        return datetime.strptime(value, '%Y-%m-%dT%H:%M:%S.%fZ')
    except Exception:
        raise TypeError("cannot convert {} to datetime type".format(value))


def validate_date(value) -> datetime:
    try:
        return datetime.strptime(value, '%Y-%m-%d')
    except Exception:
        raise TypeError(f"cannot convert {value} to datetime type")
