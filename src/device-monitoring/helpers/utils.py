from datetime import datetime, timedelta


def str_to_date(st):
    """
    Converts a string to datetime
    """
    return datetime.strptime(st, '%Y-%m-%dT%H:%M:%S.%fZ')


def date_to_str(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, '%Y-%m-%dT%H:%M:%S.%fZ')


def convert_GMT_time_to_EAT_local_time(gmt_datetime):
    """
     converts a datetime object in GMT to East African Local Time and formats it to a string value.
    """
    return datetime.strftime(gmt_datetime + timedelta(hours=3), '%a, %d %b %Y %H:%M %p')
