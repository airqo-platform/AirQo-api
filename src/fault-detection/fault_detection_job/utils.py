from datetime import datetime

def date_to_str(date, format='%Y-%m-%dT%H:%M:%S.%fZ'):
    """Converts datetime to a string"""
    return datetime.strftime(date, format)