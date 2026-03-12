import logging
from typing import Any, Mapping, Optional

from .client import (
    DEFAULT_PLATFORM_BASE_URL,
    SourceMetadataClient,
    SourceMetadataClientError,
)
from .engine import SourceMetadataEngine


logger = logging.getLogger(__name__)


def _parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return True
    return str(value).strip().lower() not in {"0", "false", "no", "off"}


def _extract_token(request: Any) -> str:
    auth_header = request.headers.get("Authorization", "").strip()
    if auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()
    x_auth_token = request.headers.get("X-Auth-Token", "").strip()
    if x_auth_token:
        return x_auth_token
    return request.args.get("token", "")


def _extract_token_transport(request: Any) -> tuple[bool, bool]:
    auth_header = request.headers.get("Authorization", "").strip()
    if auth_header.lower().startswith("bearer "):
        return False, False
    if request.headers.get("X-Auth-Token", "").strip():
        return False, True
    if request.args.get("token", "").strip():
        return True, False
    return False, False


def _build_client_error_body(ex: SourceMetadataClientError) -> dict[str, Any]:
    return {"error": "upstream service error"}


def _build_from_payload(
    engine: SourceMetadataEngine,
    payload: Mapping[str, Any],
    *,
    pollutants: Any = None,
    include_satellite: Optional[bool] = None,
) -> dict[str, Any]:
    return engine.build_from_features(
        latitude=payload.get("latitude"),
        longitude=payload.get("longitude"),
        site_category=payload.get("site_category"),
        satellite_pollutants_mean=payload.get("satellite_pollutants_mean"),
        pollutants=payload.get("pollutants") if pollutants is None else pollutants,
        include_satellite=(
            payload.get("include_satellite", True)
            if include_satellite is None
            else include_satellite
        ),
    )


def create_app(
    *,
    platform_base_url: str = DEFAULT_PLATFORM_BASE_URL,
    platform_token: Optional[str] = None,
    platform_timeout: int = 30,
) -> "Flask":
    try:
        from flask import Flask, jsonify, request
    except ImportError as ex:
        raise ImportError(
            "Flask is not installed. Install the API extra with "
            "`pip install airqosm[api]`."
        ) from ex

    app = Flask(__name__)
    engine = SourceMetadataEngine()
    client = SourceMetadataClient(
        base_url=platform_base_url,
        token=platform_token,
        timeout=platform_timeout,
    )

    @app.get("/healthz")
    def healthz():
        return jsonify({"status": "ok"}), 200

    @app.get("/api/v2/spatial/source_metadata")
    def source_metadata_from_coordinates():
        latitude = request.args.get("latitude")
        longitude = request.args.get("longitude")

        if latitude is None or longitude is None:
            return (
                jsonify({"error": "'latitude' and 'longitude' query parameters are required"}),
                400,
            )

        try:
            use_query_token, use_x_auth_token = _extract_token_transport(request)
            response = client.fetch(
                latitude=latitude,
                longitude=longitude,
                include_satellite=_parse_bool(request.args.get("include_satellite")),
                token=_extract_token(request) or None,
                use_query_token=use_query_token,
                use_x_auth_token=use_x_auth_token,
            )
            return jsonify(response), 200
        except ValueError as ex:
            return jsonify({"error": str(ex)}), 400
        except SourceMetadataClientError as ex:
            logger.exception(
                "Source metadata upstream request failed: %s; payload=%r",
                ex,
                ex.payload,
            )
            return jsonify(_build_client_error_body(ex)), ex.status_code or 502

    @app.post("/api/v1/source-metadata/from-features")
    def from_features():
        if not request.is_json:
            return jsonify({"error": "Request content type must be application/json"}), 400

        payload = request.get_json() or {}
        try:
            data = _build_from_payload(engine, payload)
            return jsonify({"message": "Operation successful", "data": data}), 200
        except Exception as ex:
            return jsonify({"error": str(ex)}), 400

    @app.post("/api/v1/source-metadata/batch-from-features")
    def batch_from_features():
        if not request.is_json:
            return jsonify({"error": "Request content type must be application/json"}), 400

        payload = request.get_json() or {}
        items = payload.get("items", [])
        if not isinstance(items, list) or len(items) == 0:
            return jsonify({"error": "'items' must be a non-empty list"}), 400

        include_satellite = payload.get("include_satellite", True)
        pollutants = payload.get("pollutants")

        results = []
        failures = []
        for idx, item in enumerate(items):
            try:
                result = _build_from_payload(
                    engine,
                    item,
                    pollutants=pollutants,
                    include_satellite=include_satellite,
                )
                result["request_id"] = item.get("id", idx)
                results.append(result)
            except Exception as ex:
                failures.append({"index": idx, "id": item.get("id"), "error": str(ex)})

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

    return app
