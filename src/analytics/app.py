
from celery import Celery, Task
from flasgger import Swagger
from flask import Flask, jsonify, send_from_directory
from flask_caching import Cache
from flask_cors import CORS
from flask_restx import Api
from werkzeug.middleware.proxy_fix import ProxyFix

from config import CONFIGURATIONS, API_BASE_URL
from config import Config
from namespaces import dashboard_api, data_export_api, auto_report_api

api = Api(
    title="AirQo API", version="1.0", description="AirQo API", prefix=API_BASE_URL
)
cache = Cache()


def celery_init_app(app: Flask) -> Celery:
    class FlaskTask(Task):
        def __call__(self, *args: object, **kwargs: object) -> object:
            with app.app_context():
                return self.run(*args, **kwargs)

    celery_app = Celery(app.name, task_cls=FlaskTask)
    celery_app.config_from_object(app.config["CELERY"])
    celery_app.set_default()
    app.extensions["celery"] = celery_app
    return celery_app


def create_app():
    app = Flask(__name__)
    app.wsgi_app = ProxyFix(app.wsgi_app)
    app.config.from_object(CONFIGURATIONS)
    app.config["CELERY"] = {
        "broker_url": f"{Config.CACHE_REDIS_URL}/0",
        "result_backend": f"{Config.CACHE_REDIS_URL}/0",
    }

    cache.init_app(app)
    Swagger(app)
    CORS(app)
    api.init_app(app)
    api.add_namespace(ns=dashboard_api)
    api.add_namespace(ns=data_export_api)
    api.add_namespace(ns=auto_report_api)

    celery = celery_init_app(app)

    @app.route("/health")
    def health():
        return jsonify(dict(message="App status - OK."))

    @app.route("/docs")
    def docs():
        return send_from_directory(directory="docs/", path="status.yml")

    return app


flask_app = create_app()
celery_app = flask_app.extensions["celery"]
