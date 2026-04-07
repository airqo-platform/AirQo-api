PM_25_COLOR_MAPPER = {
    600.4: "#808080",
    500.4: "#81202e",
    250.4: "#81202e",
    150.4: "#8639c0",
    55.4: "#fe0000",
    35.4: "#ee8310",
    12: "#f8fe28",
    0: "#45e50d",
}

# TODO: Verify that these are the right parameters
AQCSV_PARAMETER_MAPPER = {
    "pm2_5": 88500,
    "pm10": 85101,
    "no2": 42602,
}

# TODO: Verify that these are the right units
AQCSV_UNIT_MAPPER = {
    "pm2_5": "001",
    "pm10": "001",
    "no2": "008",
}

AQCSV_DATA_STATUS_MAPPER = {
    "pm2_5_calibrated_value": 1,
    "pm10_calibrated_value": 1,
    "no2_calibrated_value": 1,
    "pm2_5_raw_value": 0,
    "pm10_raw_value": 0,
    "no2_raw_value": 0,
    # only used when frequency is raw
    "no2": 0,
    "pm2_5": 0,
    "s1_pm2_5": 0,
    "pm10": 0,
    "s1_pm10": 0,
    "s2_pm2_5": 0,
    "s2_pm10": 0,
}


AQCSV_QC_CODE_MAPPER = {
    "averaged": 2,
    "estimated": 4,
}

FREQUENCY_MAPPER = {"hourly": 60, "daily": 1440, "raw": 1}
# TODO:Phase out usage
COMMON_POLLUTANT_MAPPING = {
    "pm2_5_calibrated": ["pm2_5_calibrated_value", "pm2_5"],
    "pm2_5_raw": ["pm2_5", "s1_pm2_5", "s2_pm2_5"],
    "pm2_5": [
        "pm2_5",
    ],
    "pm10_calibrated": ["pm10_calibrated_value", "pm10"],
    "pm10_raw": ["pm10", "s1_pm10", "s2_pm10"],
    "pm10": [
        "pm10",
    ],
    "no2_calibrated": ["no2_calibrated_value"],
    "no2_raw": ["no2_raw_value"],
}

COMMON_POLLUTANT_MAPPING_v2 = {
    "bam": {
        "raw": {
            "pm2_5": ["realtime_conc", "hourly_conc", "short_time_conc"],
            "pm10": [],
        },
        "averaged": {"pm2_5": ["pm2_5"], "pm10": ["pm10"]},
    },
    "lowcost": {
        "raw": {
            "pm2_5": ["pm2_5", "s1_pm2_5", "s2_pm2_5"],
            "pm10": ["pm10", "s1_pm10", "s2_pm10"],
        },
        "averaged": {
            "pm2_5": ["pm2_5_calibrated_value", "pm2_5"],
            "pm10": ["pm10_calibrated_value", "pm10"],
        },
    },
    "mobile": {
        "raw": {
            "pm2_5": ["pm2_5", "s1_pm2_5", "s2_pm2_5"],
            "pm10": ["pm10", "s1_pm10", "s2_pm10"],
        }
    },
    "satellite": {
        "raw": {
            "pm2_5": ["pm2_5"],
            "pm10": ["pm10"],
        }
    },
    "no2_calibrated": ["no2_calibrated_value"],
    "no2_raw": ["no2_raw_value"],
}

BQ_FREQUENCY_MAPPER = {
    "raw": COMMON_POLLUTANT_MAPPING,
    "daily": COMMON_POLLUTANT_MAPPING,
    "hourly": COMMON_POLLUTANT_MAPPING,
    "weekly": COMMON_POLLUTANT_MAPPING,
    "monthly": COMMON_POLLUTANT_MAPPING,
    "yearly": COMMON_POLLUTANT_MAPPING,
}

PM_COLOR_CATEGORY = {
    "Good": "#45e50d",
    "Moderate": "#f8fe28",
    "UHFSG": "#ee8310",
    "Unhealthy": "#fe0000",
    "VeryUnhealthy": "#8639c0",
    "Hazardous": "#81202e",
    "All": "#808080",
}

PM_25_CATEGORY = {
    "Good": [0, 12],
    "Moderate": [12, 35.4],
    "UHFSG": [35.4, 55.4],
    "Unhealthy": [55.4, 150.4],
    "VeryUnhealthy": [150.4, 250.4],
    "Hazardous": [250.4, 500.4],
    "All": [0, 2000],
}

PM_10_CATEGORY = {
    "Good": [0, 54],
    "Moderate": [54, 154],
    "UHFSG": [154, 254],
    "Unhealthy": [254, 354],
    "VeryUnhealthy": [354, 424],
    "Hazardous": [424, 604],
    "All": [0, 2000],
}

NO2_CATEGORY = {
    "Good": [0, 53],
    "Moderate": [53, 100],
    "UHFSG": [100, 360],
    "Unhealthy": [360, 649],
    "VeryUnhealthy": [649, 1249],
    "Hazardous": [1249, 2049],
    "All": [0, 2049],
}

WEATHER_FIELDS_MAPPER = {
    "temperature": ["device_temperature"],
    "humidity": ["device_humidity"],
    "wind_speed": ["wind_speed"],
}


def set_pm25_category_background(pm25_value):
    keys = sorted(PM_25_COLOR_MAPPER.keys(), reverse=True)

    for key in keys:
        if pm25_value > key:
            return PM_25_COLOR_MAPPER[key]


def categorise_pm25_values(records, category):
    categorised = []

    if category == "All":
        return records

    try:
        min_value, max_value = PM_25_CATEGORY.get(category, [])
    except ValueError:
        return []

    for record in records:
        if min_value < record["Last_Hour_PM25_Value"] <= max_value:
            categorised.append(record)

    return categorised


def get_pollutant_category(value, pollutant):
    """
    Function to return the category of a pollutant value
    Args:
        value (int/float): pollutant value
        pollutant (str): the name of the pollutant e.g pm25, pm10, no2

    Returns: a string representing the category og the value
    """

    mapper = {"pm2_5": PM_25_CATEGORY, "pm10": PM_10_CATEGORY, "no2": NO2_CATEGORY}

    try:
        category_mapper = dict(mapper[pollutant])
        del category_mapper["All"]
    except KeyError:
        raise Exception(f"Unknown category {pollutant}")

    for key, (min_value, max_value) in category_mapper.items():
        if min_value < value <= max_value:
            return key

    return "Unknown"
