from flask import jsonify, request
import logging
logger = logging.getLogger(__name__)

from models.source_metadata_model import SourceMetadataModel


class SourceMetadataView:
    @staticmethod
    def _parse_boolean(value, default=True):
        if value is None:
            return default
        return str(value).strip().lower() in {"1", "true", "yes", "y"}

    @staticmethod
    def _parse_pollutants(value):
        if not value:
            return []
        return [v.strip().upper() for v in str(value).split(",") if v.strip()]

    @staticmethod
    def _validate_coordinates(latitude, longitude):
        try:
            lat = float(latitude)
            lon = float(longitude)
        except (TypeError, ValueError):
            return None, None, "Latitude and longitude must be numbers."

        if lat < -90 or lat > 90:
            return None, None, "Latitude must be between -90 and 90."
        if lon < -180 or lon > 180:
            return None, None, "Longitude must be between -180 and 180."
        return lat, lon, None

    @staticmethod
    def get_source_metadata():
        latitude = request.args.get("latitude")
        longitude = request.args.get("longitude")
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        pollutants = SourceMetadataView._parse_pollutants(
            request.args.get("pollutants")
        )
        include_satellite = SourceMetadataView._parse_boolean(
            request.args.get("include_satellite"), default=True
        )

        lat, lon, error = SourceMetadataView._validate_coordinates(latitude, longitude)
        if error:
            return jsonify({"error": error}), 400

        try:
            data = SourceMetadataModel().build_source_metadata(
                latitude=lat,
                longitude=lon,
                start_date=start_date,
                end_date=end_date,
                pollutants=pollutants,
                include_satellite=include_satellite,
            )
            return jsonify({"message": "Operation successful", "data": data}), 200
        except Exception as ex:
            logger.exception("Failed to build source metadata")
            return jsonify({"error": "An internal error occurred while processing this request."}), 500

    @staticmethod
    def get_source_metadata_batch():
        if not request.is_json:
            return jsonify({"error": "Request content type must be application/json"}), 400

        payload = request.get_json() or {}
        items = payload.get("items", [])
        include_satellite = SourceMetadataView._parse_boolean(
            payload.get("include_satellite"), default=True
        )
        start_date = payload.get("start_date")
        end_date = payload.get("end_date")
        pollutants = payload.get("pollutants", [])
        if not isinstance(pollutants, list):
            return jsonify({"error": "'pollutants' must be a list."}), 400
        pollutants = [str(p).strip().upper() for p in pollutants if str(p).strip()]

        MAX_BATCH_SIZE = 100
        if not isinstance(items, list) or len(items) == 0:
            return jsonify({"error": "'items' must be a non-empty list."}), 400
        if len(items) > MAX_BATCH_SIZE:
            return jsonify({"error": f"Batch size exceeds maximum of {MAX_BATCH_SIZE} items."}), 400


        model = SourceMetadataModel()
        results = []
        failures = []

        for idx, item in enumerate(items):
            lat, lon, error = SourceMetadataView._validate_coordinates(
                item.get("latitude"), item.get("longitude")
            )
            if error:
                failures.append({"index": idx, "error": error})
                continue

            try:
                result = model.build_source_metadata(
                    latitude=lat,
                    longitude=lon,
                    start_date=start_date,
                    end_date=end_date,
                    pollutants=pollutants,
                    include_satellite=include_satellite,
                )
                result["request_id"] = item.get("id", idx)
                results.append(result)
            except Exception as ex:
                logger.exception("Failed to build source metadata for item %d", idx)
                failures.append(
                    {
                        "index": idx,
                        "id": item.get("id"),
                        "error": "An internal error occurred while processing this item.",
                    }
                )

        return (
            jsonify(
                {
                    "message": "Batch operation completed",
                    "success_count": len(results),
                    "failure_count": len(failures),
                    "results": results,
                    "failures": failures,
                }
            ),
            200,
        )
