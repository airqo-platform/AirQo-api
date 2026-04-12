from flask import Flask, jsonify
from flask_cors import CORS

from configure import configuration
from controllers.controllers import controller_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(configuration)

    # Configure CORS once instead of mixing flask-cors with manual headers.
    CORS(
        app,
        resources={r"/api/*": {"origins": "*"}},
        supports_credentials=False,
        allow_headers=[
            "Content-Type",
            "Authorization",
            "X-Requested-With",
            "X-Auth-Token",
        ],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

    app.register_blueprint(controller_bp, url_prefix="/api/v2/spatial")

    @app.get("/health")
    def health():
        return jsonify(
            {
                "status": "ok",
                "service": "spatial-api",
                "environment": app.config.get("ENVIRONMENT", "unknown"),
            }
        )

    @app.get("/test")
    def test():
        return "Test success"

    return app
