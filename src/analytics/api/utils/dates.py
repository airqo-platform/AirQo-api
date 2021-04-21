from datetime import datetime


def str_to_date(date_string, format='%Y-%m-%dT%H:%M:%S.%fZ'):
    """Converts a string to datetime"""
    return datetime.strptime(date_string, format)


def date_to_str(date, format='%Y-%m-%dT%H:%M:%S.%fZ'):
    """Converts datetime to a string"""
    return datetime.strftime(date, format)
