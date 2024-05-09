from flasgger import Swagger
from flask import Flask, jsonify, send_from_directory
from flask_caching import Cache
from flask_cors import CORS
from flask_restx import Api
from werkzeug.middleware.proxy_fix import ProxyFix

# from api.middlewares import middleware_blueprint
from api.namespaces import dashboard_api, data_export_api
from config import CONFIGURATIONS, API_BASE_URL

api = Api(title= "AirQo API", version="1.0", description="AirQo API", prefix=API_BASE_URL)
cache = Cache()
def create_app():
    app = Flask(__name__)
    app.wsgi_app = ProxyFix(app.wsgi_app)
    app.config.from_object(CONFIGURATIONS)

    cache.init_app(app)
    Swagger(app)
    CORS(app)
    api.init_app(app)
    api.add_namespace(ns=dashboard_api)
    api.add_namespace(ns=data_export_api)

    @app.route("/health")
    def health():
        return jsonify(dict(message="App status - OK."))

    @app.route("/docs")
    def docs():
        return send_from_directory(directory='api/docs', path='status.yml')

    return app
