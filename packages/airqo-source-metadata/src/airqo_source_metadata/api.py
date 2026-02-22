from flask import Flask, jsonify, request

from .engine import SourceMetadataEngine


def create_app() -> Flask:
    app = Flask(__name__)
    engine = SourceMetadataEngine()

    @app.get("/healthz")
    def healthz():
        return jsonify({"status": "ok"}), 200

    @app.post("/api/v1/source-metadata/from-features")
    def from_features():
        if not request.is_json:
            return jsonify({"error": "Request content type must be application/json"}), 400

        payload = request.get_json() or {}
        try:
            data = engine.build_from_features(
                latitude=payload.get("latitude"),
                longitude=payload.get("longitude"),
                site_category=payload.get("site_category"),
                satellite_pollutants_mean=payload.get("satellite_pollutants_mean"),
                pollutants=payload.get("pollutants"),
                include_satellite=payload.get("include_satellite", True),
            )
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
                result = engine.build_from_features(
                    latitude=item.get("latitude"),
                    longitude=item.get("longitude"),
                    site_category=item.get("site_category"),
                    satellite_pollutants_mean=item.get("satellite_pollutants_mean"),
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
