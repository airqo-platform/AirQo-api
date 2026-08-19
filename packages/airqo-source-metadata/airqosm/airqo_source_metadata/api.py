from typing import Optional

from .client import SourceMetadataClient, SourceMetadataClientError


def _parse_bool(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return True
    return str(value).strip().lower() not in {"0", "false", "no", "off"}


def _extract_token(request) -> str:
    auth_header = request.headers.get("Authorization", "").strip()
    if auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return request.args.get("token") or ""


def create_app(
    *,
    platform_base_url: str = "https://platform.airqo.net",
    platform_token: Optional[str] = None,
    platform_timeout: int = 30,
) -> "Flask":
    """Create a small proxy API for the AirQo source metadata endpoint."""
    try:
        from flask import Flask, jsonify, request
    except ImportError as ex:
        raise ImportError(
            "Flask is not installed. Install the API extra with "
            "`pip install airqosm[api]`."
        ) from ex

    app = Flask(__name__)
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
                jsonify(
                    {"error": "'latitude' and 'longitude' query parameters are required"}
                ),
                400,
            )

        request_token = _extract_token(request) or None
        if request_token is None and not platform_token:
            return jsonify({"error": "An AirQo API token is required."}), 401

        forwarded = {
            key: value
            for key, value in request.args.items()
            if key not in {"latitude", "longitude", "include_satellite", "token"}
        }
        try:
            response = client.fetch(
                latitude=latitude,
                longitude=longitude,
                include_satellite=_parse_bool(
                    request.args.get("include_satellite")
                ),
                token=request_token,
                extra_params=forwarded,
            )
            return jsonify(response), 200
        except ValueError as ex:
            return jsonify({"error": str(ex)}), 400
        except SourceMetadataClientError as ex:
            payload = ex.payload if isinstance(ex.payload, dict) else {}
            body = dict(payload)
            if not body:
                body = {"error": str(ex)}
            elif "error" not in body and "message" not in body:
                body["error"] = str(ex)
            return jsonify(body), ex.status_code or 502

    return app
