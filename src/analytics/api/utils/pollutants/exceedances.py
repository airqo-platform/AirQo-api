"""
Exceedance category standards and counting.

Lifted verbatim from the Flask-era api/models/exceedance.py so the logic
can be used without the Flask cache / Mongo base coupling.  Bounds are
inclusive on both ends: a value counts for the first band where
lower <= value <= upper (dict insertion order Good → Hazardous); values
outside every band are counted nowhere.
"""

from __future__ import annotations

from typing import Dict

import pandas as pd

STANDARDS_MAPPING = {
    "aqi": {
        "pm2_5": {
            "Good": [0, 12],
            "Moderate": [12.1, 35.4],
            "UHFSG": [35.5, 55.4],
            "Unhealthy": [55.5, 150.4],
            "VeryUnhealthy": [150.5, 250.4],
            "Hazardous": [250.5, 500.4],
        },
        "pm10": {
            "Good": [0, 54],
            "Moderate": [55, 154],
            "UHFSG": [155, 254],
            "Unhealthy": [255, 354],
            "VeryUnhealthy": [355, 424],
            "Hazardous": [425, 604],
        },
    },
    "who": {
        "pm2_5": {
            "Good": [0, 10],
            "Moderate": [11, 25],
            "UHFSG": [26, 50],
            "Unhealthy": [51, 90],
            "VeryUnhealthy": [91, 120],
            "Hazardous": [121, 250],
        },
        "pm10": {
            "Good": [0, 20],
            "Moderate": [21, 50],
            "UHFSG": [51, 90],
            "Unhealthy": [91, 150],
            "VeryUnhealthy": [151, 250],
            "Hazardous": [251, 350],
        },
    },
}


def count_standard_categories(
    df: pd.DataFrame, standard: str, pollutant: str
) -> Dict[str, Dict[str, int]]:
    """
    Count, per device, how many rows fall into each category band.

    Expects one row per (device_id, day) with the daily mean in a column
    named after the pollutant.  Every device present in the frame gets an
    entry — a device whose every value is out-of-band yields {} (and a
    caller-computed total of 0), matching the Flask behaviour.
    """

    def find_category(value, mapping):
        for category, bounds in mapping.items():
            lower, upper = bounds
            if lower <= value <= upper:
                return category
        return None

    device_counts: Dict[str, Dict[str, int]] = {}
    mapping = STANDARDS_MAPPING[standard][pollutant]

    for _, row in df.iterrows():
        device_id = row["device_id"]
        pollutant_value = row[pollutant]
        category = find_category(pollutant_value, mapping)

        if device_id not in device_counts:
            device_counts[device_id] = {}

        if category:
            if category not in device_counts[device_id]:
                device_counts[device_id][category] = 0
            device_counts[device_id][category] += 1

    return device_counts
