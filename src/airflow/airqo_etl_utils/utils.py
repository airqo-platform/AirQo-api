import json
import os


def get_file_content(file_name: str):
    path, _ = os.path.split(__file__)
    file_name_path = f"schema/{file_name}"
    try:
        file_json = open(os.path.join(path, file_name_path))
    except FileNotFoundError:
        file_json = open(os.path.join(path, file_name))

    return json.load(file_json)


def get_air_quality(pm2_5: float) -> str:
    if pm2_5 <= 12.09:
        return "Good"
    elif 12.1 <= pm2_5 <= 35.49:
        return "Moderate"
    elif 35.5 <= pm2_5 <= 55.49:
        return "Unhealthy For Sensitive Groups"
    elif 55.5 <= pm2_5 <= 150.49:
        return "Unhealthy"
    elif 150.5 <= pm2_5 <= 250.49:
        return "Very Unhealthy"
    elif pm2_5 >= 250.5:
        return "Hazardous"
    return ""
