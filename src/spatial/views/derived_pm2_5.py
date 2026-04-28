from flask import request, jsonify
from models.pull_satellite_model import (
    PM25Model,
    PM25ModelDaily,
    Sentinel5PModel,
    SatelliteData,
)
from configure import Config
import numpy as np
import logging

logging.basicConfig(level=logging.ERROR)


class PM25View:
    @staticmethod
    def get_pm25():
        # Check if request has JSON content type
        if not request.is_json:
            return (
                jsonify({"error": "Request content type must be application/json"}),
                400,
            )

        # Get JSON data from request
        data = request.get_json()

        # Check if all required parameters are present in the JSON data
        required_params = ["longitude", "latitude", "start_date", "end_date"]
        for param in required_params:
            if param not in data:
                return jsonify({"error": f"Missing parameter: {param}"}), 400

        # Retrieve parameters from the JSON data
        try:
            longitude = float(data["longitude"])
            latitude = float(data["latitude"])
            start_date = data["start_date"]
            end_date = data["end_date"]

            # Call the model to get PM2.5 data
            model = PM25Model()
            data = model.get_pm25_from_satellite(
                longitude, latitude, start_date, end_date
            )

            # Return the data with appropriate JSON format and headers
            response_data = {
                "Title": "PM2.5 from configured satellite/model provider",
                "determined_pm2_5": data.to_dict(orient="records")[0],
            }
            # Return the response with appropriate JSON format and headers
            return jsonify(response_data), 200, {"Content-Type": "application/json"}

        #            return jsonify(data.to_dict(orient='records')[0]), 200, {'Content-Type': 'application/json'}

        except Exception as e:
            logging.error("An error occurred: %s", str(e))
            return (
                jsonify({"error": "An internal error has occurred!"}),
                500,
                {"Content-Type": "application/json"},
            )


#            return jsonify({'error': 'An internal error occurred'}), 500, {'Content-Type': 'application/json'}


# Example usage
# This part should be handled in your Flask application's route handler
# pm_view = PM25View()
# pm_data, status_code, headers = pm_view.get_pm25()
# return pm_data, status_code, headers
class PM25_aod_Model_daily:
    @staticmethod
    def get_aod_for_dates():
        # Check if request has JSON content type
        if not request.is_json:
            return (
                jsonify({"error": "Request content type must be application/json"}),
                400,
            )

        # Get JSON data from request
        data = request.get_json()

        # Check if all required parameters are present in the JSON data
        required_params = ["longitude", "latitude", "start_date", "end_date"]
        for param in required_params:
            if param not in data:
                return jsonify({"error": f"Missing parameter: {param}"}), 400

        # Retrieve parameters from the JSON data
        try:
            longitude = float(data["longitude"])
            latitude = float(data["latitude"])
            start_date = data["start_date"]
            end_date = data["end_date"]

            # Call the model to get AOD data
            model = PM25ModelDaily()
            result_data = model.get_aod_for_dates(
                longitude, latitude, start_date, end_date
            )

            # Convert the DataFrame to a dictionary format
            columns = list(result_data.columns)
            rows = result_data.to_dict(orient="records")

            # Prepare the response data
            response_data = {
                "Title": "Daily PM2.5/PM10 from configured satellite/model provider",
                "columns": columns,
                "rows": rows,
            }

            # Return the response with appropriate JSON format and headers
            return jsonify(response_data), 200, {"Content-Type": "application/json"}

        except Exception as e:
            print(f"Internal error")
            return (
                jsonify({"error": "An internal error occurred"}),
                500,
                {"Content-Type": "application/json"},
            )


class Sentinel5PView:
    DEFAULT_NOAA_POLLUTANTS = ["NO2", "SO2", "CO", "O3", "HCHO", "AOD", "PM2_5", "PM10"]

    @staticmethod
    def get_pollutants_data():
        # Check if request has JSON content type
        if not request.is_json:
            return (
                jsonify({"error": "Request content type must be application/json"}),
                400,
            )

        # Get JSON data from request
        data = request.get_json()

        # Check if all required parameters are present in the JSON data
        required_params = ["longitude", "latitude", "start_date", "end_date"]
        for param in required_params:
            if param not in data:
                return jsonify({"error": f"Missing parameter: {param}"}), 400

        # Retrieve parameters from the JSON data
        try:
            longitude = float(data["longitude"])
            latitude = float(data["latitude"])
            start_date = data["start_date"]
            end_date = data["end_date"]
            pollutants = data.get("pollutants") or (
                Sentinel5PView.DEFAULT_NOAA_POLLUTANTS
                if Config.SOURCE_METADATA_SATELLITE_PROVIDER == "noaa_nomads"
                else ["SO2", "HCHO", "CO", "NO2", "O3"]
            )

            # Call the model to get pollutant data
            model = Sentinel5PModel()
            result_data = model.get_pollutant_data(
                longitude, latitude, start_date, end_date, pollutants
            )

            # Convert the DataFrame to a dictionary format
            columns = list(result_data.columns)
            rows = result_data.to_dict(orient="records")

            # Prepare the response data
            response_data = {
                "Title": (
                    "NOAA NOMADS GEFS-Chem + gas model pollutant data"
                    if Config.SOURCE_METADATA_SATELLITE_PROVIDER == "noaa_nomads"
                    else "Daily Sentinel-5P Pollutant Data"
                ),
                "provider": Config.SOURCE_METADATA_SATELLITE_PROVIDER,
                "columns": columns,
                "rows": rows,
            }

            # Replace NaN values with null
            def replace_nan_with_null(obj):
                if isinstance(obj, list):
                    return [replace_nan_with_null(item) for item in obj]
                elif isinstance(obj, dict):
                    return {
                        key: replace_nan_with_null(value) for key, value in obj.items()
                    }
                elif isinstance(obj, float) and np.isnan(obj):
                    return None
                else:
                    return obj

            response_data = replace_nan_with_null(response_data)

            # Return the response with appropriate JSON format and headers
            return jsonify(response_data), 200, {"Content-Type": "application/json"}

        except Exception as e:
            print(f"Internal error: {e}")
            return (
                jsonify({"error": "An internal error occurred"}),
                500,
                {"Content-Type": "application/json"},
            )


class Satellite_data:
    @staticmethod
    def get_pollutants_data():
        # Check if request has JSON content type
        if not request.is_json:
            return (
                jsonify({"error": "Request content type must be application/json"}),
                400,
            )

        # Get JSON data from request
        data = request.get_json()

        # Check if all required parameters are present in the JSON data
        required_params = ["longitude", "latitude", "start_date", "end_date"]
        for param in required_params:
            if param not in data:
                return jsonify({"error": f"Missing parameter: {param}"}), 400

        # Retrieve parameters from the JSON data
        try:
            longitude = float(data["longitude"])
            latitude = float(data["latitude"])
            start_date = data["start_date"]
            end_date = data["end_date"]

            # Call the model to get pollutant data
            model = SatelliteData()
            result_data = model.get_merged_pollutant_data(
                longitude, latitude, start_date, end_date
            )

            # Convert the DataFrame to a dictionary format
            columns = list(result_data.columns)
            rows = result_data.to_dict(orient="records")

            # Prepare the response data
            response_data = {
                "Title": "Daily_Sentinel-5P_Pollutant_Data",
                "columns": columns,
                "rows": rows,
            }

            # Replace NaN values with null
            def replace_nan_with_null(obj):
                if isinstance(obj, list):
                    return [replace_nan_with_null(item) for item in obj]
                elif isinstance(obj, dict):
                    return {
                        key: replace_nan_with_null(value) for key, value in obj.items()
                    }
                elif isinstance(obj, float) and np.isnan(obj):
                    return None
                else:
                    return obj

            response_data = replace_nan_with_null(response_data)

            # Return the response with appropriate JSON format and headers
            return jsonify(response_data), 200, {"Content-Type": "application/json"}

        except Exception as e:
            print(f"Internal error:")
            return (
                jsonify({"error": "An internal error occurred"}),
                500,
                {"Content-Type": "application/json"},
            )
