import pandas as pd
from flask import Blueprint, request, jsonify, make_response
from pandas.errors import EmptyDataError, ParserError

from models import calibrate_tool as calibration_tool
from models import train_calibrate_tool as training_tool
import routes as api

calibrate_bp = Blueprint("calibrate_bp", __name__)

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
REQUIRED_CALIBRATION_COLUMNS = (
    "datetime",
    "pm10",
    "s2_pm10",
    "humidity",
    "temperature",
)
PM2_5_SENSOR_COLUMNS = ("pm2_5", "s2_pm2_5")
PM2_5_AVERAGE_COLUMN = "avg_pm2_5"
CALIBRATION_COLUMNS = (
    *REQUIRED_CALIBRATION_COLUMNS,
    *PM2_5_SENSOR_COLUMNS,
    PM2_5_AVERAGE_COLUMN,
)


def _error(message, status_code=400):
    return jsonify({"message": message, "success": False}), status_code


def _validate_csv_upload(file):
    if not file or not file.filename:
        return _error("Please upload a CSV file.")

    if not file.filename.lower().endswith(".csv"):
        return _error("Only CSV files are supported.")

    stream = file.stream
    current_position = stream.tell()
    stream.seek(0, 2)
    file_size = stream.tell()
    stream.seek(current_position)

    if file_size > MAX_UPLOAD_BYTES:
        return _error("The uploaded CSV file cannot exceed 20 MB.", 413)

    if file_size == 0:
        return _error("The uploaded CSV file is empty.")

    return None


def _read_csv(file):
    try:
        return pd.read_csv(file), None
    except (EmptyDataError, ParserError, UnicodeDecodeError, ValueError):
        return None, _error("The uploaded file is not a valid CSV file.")


@calibrate_bp.route(api.route["calibrate_tool"], methods=["POST"])
def calibrate_tool():
    if "file" not in request.files:
        return _error(
            "File missing. Refer to the API documentation for details."
        )

    map_columns = {
        column: request.form.get(column) for column in CALIBRATION_COLUMNS
    }

    has_required_columns = all(
        map_columns[column] for column in REQUIRED_CALIBRATION_COLUMNS
    )
    has_pm2_5_average = bool(map_columns[PM2_5_AVERAGE_COLUMN])
    has_pm2_5_sensor_pair = all(
        map_columns[column] for column in PM2_5_SENSOR_COLUMNS
    )
    if not has_required_columns or not (
        has_pm2_5_average or has_pm2_5_sensor_pair
    ):
        return _error(
            "Please map datetime, PM10 sensor 1, PM10 sensor 2, temperature, "
            "humidity, and either avg_pm2_5 or both PM2.5 sensor columns. "
            "Refer to the API documentation for details."
        )

    file = request.files.get("file")
    upload_error = _validate_csv_upload(file)
    if upload_error:
        return upload_error

    df, csv_error = _read_csv(file)
    if csv_error:
        return csv_error

    map_columns = {
        column: csv_column
        for column, csv_column in map_columns.items()
        if csv_column
    }

    if len(set(map_columns.values())) != len(map_columns):
        return _error("Each calibration field must map to a different CSV column.")

    missing_columns = sorted(set(map_columns.values()) - set(df.columns))
    if missing_columns:
        return _error(
            "The following mapped columns are missing from the uploaded file: "
            + ", ".join(missing_columns)
        )

    country = request.form.get("country")
    try:
        rg_model = calibration_tool.Regression(country=country)
    except ValueError as error:
        return _error(str(error))
    except calibration_tool.CalibrationModelError:
        return _error(
            "The requested calibration model is currently unavailable.", 503
        )

    map_columns = {value: key for key, value in map_columns.items()}
    try:
        calibrated_data = rg_model.compute_calibrated_val(map_columns, df)
    except (KeyError, TypeError, ValueError) as error:
        return _error(f"The uploaded data could not be calibrated: {error}")
    except calibration_tool.CalibrationModelError:
        return _error(
            "The requested calibration model could not process the data.", 503
        )

    resp = make_response(calibrated_data.to_csv(index=False))
    resp.headers["Content-Disposition"] = "attachment; filename=calibrated_data.csv"
    resp.headers["Content-Type"] = "text/csv"
    return resp


@calibrate_bp.route(api.route["train_calibrate_tool"], methods=["POST"])
def train_calibrate_tool():
    valid_pollutants = ("pm2_5", "pm10")
    pollutant = request.form["pollutant"]
    pollutant = pollutant.lower()
    if pollutant not in valid_pollutants:
        return (
            jsonify(
                {
                    "message": "Please specify valid pollutant (e.g pm2_5 or pm10)",
                    "success": False,
                }
            ),
            400,
        )
    map_columns = request.form
    file = request.files["file"]
    df = pd.read_csv(file)
    if (
        not file
        or not pollutant
        or not map_columns["ref_data"]
        or not map_columns["datetime"]
        or not map_columns["pm2_5"]
        or not map_columns["s2_pm2_5"]
        or not map_columns["pm10"]
        or not map_columns["s2_pm10"]
        or not map_columns["temperature"]
        or not map_columns["humidity"]
    ):
        return (
            jsonify(
                {
                    "message": "Please specify pollutant and upload CSV file with the following "
                    "information datetime, sensor1 pm2.5, sensor2 pm2.5, sensor1 pm10,"
                    " sensor1 pm10, temperature, humidity values and reference monitor PM."
                    " Refer to the API documentation for details.",
                    "success": False,
                }
            ),
            400,
        )

    rg_tool = training_tool.Train_calibrate_tool()

    map_columns = {value: key for key, value in map_columns.items()}
    calibrated_data_ext = rg_tool.train_calibration_model(pollutant, map_columns, df)
    resp = make_response(calibrated_data_ext.to_csv())
    resp.headers["Content-Disposition"] = "attachment; filename=calibrated_data_ext.csv"
    resp.headers["Content-Type"] = "text/csv"
    return resp
