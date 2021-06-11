def get_value(measurement):
    if measurement is None:
        return None

    if "value" in measurement:
        try:
            value = float(measurement["value"])
            return value
        except Exception:
            return None

    return None


def get_calibrated_value(measurement):
    if measurement is None:
        return None

    if "calibratedValue" in measurement:
        try:
            calibrated_value = float(measurement["calibratedValue"])
            return calibrated_value
        except Exception:
            return None
    return None


def check_null(value):
    if value is None or str(value).strip().lower() == 'null' or str(value).strip().lower() == 'none':
        return 0.0
    return value


def flatten_json(measurements_json):

    measurement = dict({
        's2_pm2_5': check_null(get_value(measurements_json['s2_pm2_5'])),
        's2_pm2_5_calibrate': check_null(get_calibrated_value(measurements_json['s2_pm2_5'])),
        's2_pm10': check_null(get_value(measurements_json['s2_pm10'])),
        's2_pm10_calibrate': check_null(get_calibrated_value(measurements_json['s2_pm10'])),
        'pm2_5': check_null(get_value(measurements_json['pm2_5'])),
        'pm2_5_calibrate': check_null(get_calibrated_value(measurements_json['pm2_5'])),
        'pm10': check_null(get_value(measurements_json['pm10'])),
        'pm10_calibrate': check_null(get_calibrated_value(measurements_json['pm10'])),
        'internalTemperature': check_null(get_value(measurements_json['internalTemperature'])),
        'internalTemperature_calibrate': check_null(get_calibrated_value(measurements_json['internalTemperature'])),
        'internalHumidity': check_null(get_value(measurements_json['internalHumidity'])),
        'internalHumidity_calibrate': check_null(get_calibrated_value(measurements_json['internalHumidity'])),
        'externalTemperature': check_null(get_value(measurements_json['externalTemperature'])),
        'externalTemperature_calibrate': check_null(get_calibrated_value(measurements_json['externalTemperature'])),
        'externalHumidity': check_null(get_value(measurements_json['externalHumidity'])),
        'externalHumidity_calibrate': check_null(get_calibrated_value(measurements_json['externalHumidity'])),
        'hdop': check_null(get_value(measurements_json['hdop'])),
        'hdop_calibrate': check_null(get_calibrated_value(measurements_json['hdop'])),
        'speed': check_null(get_value(measurements_json['speed'])),
        'speed_calibrate': check_null(get_calibrated_value(measurements_json['speed'])),
        'no2': check_null(get_value(measurements_json['no2'])),
        'no2_calibrate': check_null(get_calibrated_value(measurements_json['no2'])),
        'pm1': check_null(get_value(measurements_json['pm1'])),
        'pm1_calibrate': check_null(get_calibrated_value(measurements_json['pm1'])),
        'altitude': check_null(get_value(measurements_json['altitude'])),
        'altitude_calibrate': check_null(get_calibrated_value(measurements_json['altitude'])),
        'battery': check_null(get_value(measurements_json['battery'])),
        'battery_calibrate': check_null(get_calibrated_value(measurements_json['battery'])),
        'satellites': check_null(get_value(measurements_json['satellites'])),
        'satellites_calibrate': check_null(get_calibrated_value(measurements_json['satellites'])),
    })

    return measurement


def measurements_to_json(measurements):

    json_body = dict({
        "pm2_5": {"value": measurements["pm2_5"], "calibratedValue": measurements["pm2_5_calibrate"]},
        "pm10": {"value": measurements["pm10"], "calibratedValue": measurements["pm10_calibrate"]},
        "s2_pm2_5": {"value": measurements["s2_pm2_5"], "calibratedValue": measurements["s2_pm2_5_calibrate"]},
        "s2_pm10": {"value": measurements["s2_pm10"], "calibratedValue": measurements["s2_pm10_calibrate"]},
        "speed": {"value": measurements["speed"], "calibratedValue": measurements["speed_calibrate"]},
        "hdop": {"value": measurements["hdop"], "calibratedValue": measurements["hdop_calibrate"]},
        "internalTemperature": {"value": measurements["internalTemperature"], "calibratedValue": measurements["internalTemperature_calibrate"]},
        "internalHumidity": {"value": measurements["internalHumidity"], "calibratedValue": measurements["internalHumidity_calibrate"]},
        "externalTemperature": {"value": measurements["externalTemperature"], "calibratedValue": measurements["externalTemperature_calibrate"]},
        "externalHumidity": {"value": measurements["externalHumidity"], "calibratedValue": measurements["externalHumidity_calibrate"]},
        "no2": {"value": measurements["no2"], "calibratedValue": measurements["no2_calibrate"]},
        "pm1": {"value": measurements["pm1"], "calibratedValue": measurements["pm1_calibrate"]},
        "altitude": {"value": measurements["altitude"], "calibratedValue": measurements["altitude_calibrate"]},
        "satellites": {"value": measurements["satellites"], "calibratedValue": measurements["satellites_calibrate"]},
        "battery": {"value": measurements["battery"], "calibratedValue": measurements["battery_calibrate"]},
    })

    return json_body
