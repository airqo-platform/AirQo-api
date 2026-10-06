from datetime import datetime


def str_to_date(date_string, format="%Y-%m-%dT%H:%M:%S.%fZ"):
    """Converts a string to datetime"""
    return datetime.strptime(date_string, format)


def str_to_aqcsv_date_format(date_string):
    """
    Convert a query time such as "2026-03-01 14:00:00Z" to the AQCSV form
    "20260301T1400".  The queries end each time with "Z", the marker of UTC,
    and the conversion accepts a time with or without it.
    """
    return date_to_str(
        str_to_date(date_string.removesuffix("Z"), format="%Y-%m-%d %H:%M:%S"),
        format="%Y%m%dT%H%M",
    )


def date_to_str(date, format="%Y-%m-%dT%H:%M:%S.%fZ"):
    """Converts datetime to a string"""
    return datetime.strftime(date, format)
