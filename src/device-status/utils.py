from datetime import datetime, timedelta

def str_to_date(st):
    """Converts a string to datetime"""
    return datetime.strptime(st, '%Y-%m-%dT%H:%M:%S.%fZ')


def date_to_str(date):
    """Converts datetime to a string"""
    return datetime.strftime(date, '%Y-%m-%dT%H:%M:%S.%fZ')


def convert_GMT_time_to_EAT_local_time(gmt_datetime):
    """converts a datetime object in GMT to East African Local Time and formats it to a string value."""
    return datetime.strftime(gmt_datetime + timedelta(hours=3), '%a, %d %b %Y %H:%M %p')


def convert_to_date(gmt_datetime):
    return datetime.strftime(gmt_datetime, '%Y-%m-%d')


def str_to_date_find(st):
    """
    Converts a string of different format to datetime
    """
    return datetime.strptime(st, '%Y-%m-%dT%H:%M:%SZ')


def date_to_formated_str(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, '%Y-%m-%d %H:%M')


def convert_seconds_to_days_hours_minutes_seconds(seconds_to_convert):
    day = seconds_to_convert // (24 * 3600)
    seconds_to_convert = seconds_to_convert % (24 * 3600)
    hour = seconds_to_convert // 3600
    seconds_to_convert %= 3600
    minutes = seconds_to_convert // 60
    seconds_to_convert %= 60
    seconds = seconds_to_convert
    result = str(int(day)) + " days " + str(int(hour)) + " hours " + \
        str(int(minutes)) + " minutes " + str(int(seconds)) + " seconds"
    return result