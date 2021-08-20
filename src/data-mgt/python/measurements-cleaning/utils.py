import pandas as pd


def convert_to_numeric(original_value):
    return pd.to_numeric(original_value, errors='coerce')


def convert_to_tenant(original_value):
    if f'{original_value}'.strip().lower() == 'kcca':
        return 'kcca'
    elif f'{original_value}'.strip().lower() == 'airqo':
        return 'airqo'
    else:
        return None

