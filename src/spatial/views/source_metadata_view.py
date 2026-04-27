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
logger = logging.getLogger(__name__)

from configure import Config
from models.source_metadata_model import (
    SourceMetadataModel,
    parse_boolean,
    validate_coordinates,
)


class SourceMetadataView:
    """Request handlers for source metadata API routes.

    The class centralizes request parsing and validation for coordinate-driven
    source attribution endpoints. Business logic is delegated to
    :class:`SourceMetadataModel`.
    """

    @staticmethod
    def _parse_boolean(value, default=False):
        """Parse a user-provided value into a boolean.

        Args:
            value: Raw input value (commonly query/body field).
            default: Value returned when ``value`` is ``None``.

        Returns:
            ``True`` for common truthy inputs (``1``, ``true``, ``yes``, ``y``),
            otherwise ``False``. If ``value`` is ``None``, returns ``default``.
        """
        return parse_boolean(value, default=default)

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
        return validate_coordinates(latitude, longitude)

    @staticmethod
    def _validate_buffer_radius(value):
        if value is None:
            return 1000, None
        try:
            radius = int(value)
        except (TypeError, ValueError):
            return None, "buffer_radius_m must be an integer."
        if radius <= 0 or radius > 50000:
            return None, "buffer_radius_m must be between 1 and 50000."
        return radius, None

    @staticmethod
    def get_source_metadata():
        """Handle single-point source metadata inference.

        Expected query parameters:
        - ``latitude`` (required): float in [-90, 90]
        - ``longitude`` (required): float in [-180, 180]
        - ``satellite`` (optional): boolean-like value, default ``false``
        - ``buffer_radius_m`` (optional): integer, default ``1000``

        Responses:
        - ``200``: source metadata JSON
        - ``400``: validation error (coordinates)
        - ``500``: unexpected server-side error
        """
        latitude = request.args.get("latitude")
        longitude = request.args.get("longitude")
        satellite = SourceMetadataView._parse_boolean(
            request.args.get("satellite"),
            default=Config.SOURCE_METADATA_SATELLITE_DEFAULT,
        )

        lat, lon, error = SourceMetadataView._validate_coordinates(latitude, longitude)
        if error:
            return jsonify({"error": error}), 400
        buffer_radius_m, error = SourceMetadataView._validate_buffer_radius(
            request.args.get("buffer_radius_m")
        )
        if error:
            return jsonify({"error": error}), 400

        try:
            data = SourceMetadataModel().build_source_metadata(
                latitude=lat,
                longitude=lon,
                buffer_radius_m=buffer_radius_m,
                satellite=satellite,
            )
           
            return jsonify(data), 200
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
        - ``satellite`` (optional): boolean-like value, default ``false``
        - ``buffer_radius_m`` (optional): integer, default ``1000``

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
        satellite = SourceMetadataView._parse_boolean(
            payload.get("satellite"),
            default=Config.SOURCE_METADATA_SATELLITE_DEFAULT,
        )
        buffer_radius_m, error = SourceMetadataView._validate_buffer_radius(
            payload.get("buffer_radius_m")
        )
        if error:
            return jsonify({"error": error}), 400

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
                    buffer_radius_m=buffer_radius_m,
                    satellite=satellite,
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
