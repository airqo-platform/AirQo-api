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
