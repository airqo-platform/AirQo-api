from datetime import datetime

import pandas as pd


def str_to_date(str):
    """
    Converts a string to datetime
    """
    try:
        return datetime.strptime(str, '%Y-%m-%dT%H:%M:%S.%fZ')
    except ValueError:
        return datetime.strptime(str, '%Y-%m-%dT%H:%M:%SZ')


def date_to_str(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, '%Y-%m-%dT%H:%M:%S.%fZ')


def is_valid_double(value):
    try:
        float(value)
        return True
    except ValueError:
        return False


def handle_api_error(api_request):
    json = None

    try:
        json = api_request.json()
        print(api_request.request.url)
        print(api_request.request.body)
    finally:
        if json and 'error' in json and 'message' in json['error']:
            print(json)
            raise Exception(json['error']['message'])
        else:
            print(api_request.content)
            raise Exception('API request failed with status code %s' % api_request.status_code)


def array_to_csv(data):
    df = pd.DataFrame(data)
    df.to_csv(path_or_buf="formatted_devices.csv", index=False)


def array_to_json(data):
    df = pd.DataFrame(data)
    df.to_json(path_or_buf="formatted_devices.json", orient="records")
