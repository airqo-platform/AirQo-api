from datetime import datetime


def convert_date_to_formatted_str(date, frequency):
    """
    Converts datetime to a string basing on the frequency passed.
    """
    if frequency == 'monthly':
        return datetime.strftime(date, '%B %Y')
    elif frequency == 'daily':
        return datetime.strftime(date, '%Y-%m-%d')
    else:
        return datetime.strftime(date, '%Y-%m-%d %H:%M')


def date_to_formatted_str(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, '%Y-%m-%d %H:%M')


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


def date_to_str2(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, '%Y-%m-%dT%H:%M:%SZ')


def str_to_date_find(st):
    """
    Converts a string of different format to datetime
    """
    return datetime.strptime(st, '%Y-%m-%dT%H:%M:%SZ')


def generate_datetime(date, time):
    if date is None or date == "":
        return None
    else:
        if time is None or time == "":
            time = "00:00"
        date_time = date+"T"+time+":00Z"
        return date_time
