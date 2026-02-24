"""HTTP views for source metadata inference endpoints.

Endpoints in this module are thin request/response adapters around
``SourceMetadataModel.build_source_metadata``.

Supported operations:
- Single-point inference from query parameters.
- Batch inference from a JSON payload containing multiple coordinates.

All responses are JSON. Validation errors return HTTP 400 and unexpected
failures return HTTP 500.
"""

from flask import jsonify, request
import logging
import math
logger = logging.getLogger(__name__)

from models.source_metadata_model import SourceMetadataModel


class SourceMetadataView:
    """Request handlers for source metadata API routes.

    The class centralizes request parsing and validation for coordinate-driven
    source attribution endpoints. Business logic is delegated to
    :class:`SourceMetadataModel`.
    """

    @staticmethod
    def _parse_boolean(value, default=True):
        """Parse a user-provided value into a boolean.

        Args:
            value: Raw input value (commonly query/body field).
            default: Value returned when ``value`` is ``None``.

        Returns:
            ``True`` for common truthy inputs (``1``, ``true``, ``yes``, ``y``),
            otherwise ``False``. If ``value`` is ``None``, returns ``default``.
        """
        if value is None:
            return default
        return str(value).strip().lower() in {"1", "true", "yes", "y"}

    @staticmethod
    def _parse_pollutants(value):
        """Parse comma-separated pollutants from query text.

        Args:
            value: String like ``"no2, so2, co"`` or ``None``.

        Returns:
            A list of uppercase pollutant identifiers with empty entries removed.
        """
        if not value:
            return []
        return [v.strip().upper() for v in str(value).split(",") if v.strip()]

    @staticmethod
    def _validate_coordinates(latitude, longitude):
        """Validate and coerce latitude/longitude into float coordinates.

        Args:
            latitude: Latitude input from request.
            longitude: Longitude input from request.

        Returns:
            Tuple ``(lat, lon, error)`` where:
            - ``lat`` and ``lon`` are floats when valid, else ``None``.
            - ``error`` is ``None`` when valid, else a user-safe message.
        """
        try:
            lat = float(latitude)
            lon = float(longitude)
        except (TypeError, ValueError):
            return None, None, "Latitude and longitude must be numbers."

        if not math.isfinite(lat) or not math.isfinite(lon):
            return None, None, "Latitude and longitude must be finite numbers."

        if lat < -90 or lat > 90:
            return None, None, "Latitude must be between -90 and 90."
        if lon < -180 or lon > 180:
            return None, None, "Longitude must be between -180 and 180."
        return lat, lon, None

    @staticmethod
    def get_source_metadata():
        """Handle single-point source metadata inference.

        Expected query parameters:
        - ``latitude`` (required): float in [-90, 90]
        - ``longitude`` (required): float in [-180, 180]
        - ``start_date`` (optional): ``YYYY-MM-DD``
        - ``end_date`` (optional): ``YYYY-MM-DD``
        - ``pollutants`` (optional): comma-separated list, e.g. ``NO2,SO2,CO``
        - ``include_satellite`` (optional): boolean-like value, default ``true``

        Responses:
        - ``200``: ``{"message": "Operation successful", "data": ...}``
        - ``400``: validation error (coordinates)
        - ``500``: unexpected server-side error
        """
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
        except Exception:
            logger.exception("Failed to build source metadata")
            return jsonify({"error": "An internal error occurred while processing this request."}), 500

    @staticmethod
    def get_source_metadata_batch():
        """Handle batch source metadata inference from JSON payload.

        Expected JSON body:
        - ``items`` (required): non-empty list (max 100) of objects with:
          - ``latitude`` (required)
          - ``longitude`` (required)
          - ``id`` (optional request identifier echoed as ``request_id``)
        - ``start_date`` (optional): ``YYYY-MM-DD``
        - ``end_date`` (optional): ``YYYY-MM-DD``
        - ``pollutants`` (optional): list of pollutant strings
        - ``include_satellite`` (optional): boolean-like value, default ``true``

        Behavior:
        - Invalid top-level payload structure returns ``400``.
        - Per-item validation/processing failures are collected in ``failures``.
        - Valid items are returned in ``results`` with best-effort processing.

        Response:
        - ``200`` with aggregate counts and per-item success/failure details.
        """
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
            except Exception:
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
