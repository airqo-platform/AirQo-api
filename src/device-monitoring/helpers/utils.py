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
    return datetime.strftime(date,'%Y-%m-%dT%H:%M:%S.%fZ')