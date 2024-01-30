"""Module Application entry point"""

# Third-Party libraries
from flasgger import swag_from
from flask import jsonify
from decouple import config as env_config

# Config
from main import create_app, rest_api
from config import config

# utils
from api.utils.pre_request import PreRequest

from api.models.base.data_processing import air_quality_data


config_name = env_config("FLASK_ENV", "production")

app = create_app(rest_api, config=config[config_name])


# @app.before_request
def check_tenant_param():
    return PreRequest.check_tenant()


@app.route("/health")
@swag_from("/api/docs/status.yml")
def index():
    return jsonify(dict(message=f"App status - OK."))

# Add a new route for air_quality_data
@app.route("/report", methods=['POST'])
@swag_from("/api/docs/status.yml")
def air_quality_data_route():
    return air_quality_data()  # Call the air_quality_data function



if __name__ == "__main__":
    app.run()
