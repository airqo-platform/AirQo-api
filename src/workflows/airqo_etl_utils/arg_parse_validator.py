import argparse
from datetime import datetime


def valid_datetime_format(arg_str: str) -> str:
    try:
        datetime.strptime(arg_str, "%Y-%m-%dT%H:%M:%SZ")
        return arg_str
    except ValueError:
        msg = "Invalid Datetime {0} format. Expected format: 'yyyy-MM-ddThh:mm:ssZ'".format(
            arg_str
        )
        raise argparse.ArgumentTypeError(msg)
