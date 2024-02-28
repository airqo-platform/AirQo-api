"""Module Application entry point"""

# Third-Party libraries
from flasgger import swag_from
from flask import jsonify
from decouple import config as env_config

# Config
from main import create_app, rest_api, rest_api_v2
from config import config

# utils
from api.utils.pre_request import PreRequest

from api.models.base.data_processing import air_quality_data
from api.models.base.diurnal_data_processing import air_quality_data_diurnal

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
@app.route("/api/v2/analytics/grid/report", methods=['POST'])
def air_quality_data_route():
    return air_quality_data()  # Call the air_quality_data function

@app.route("/api/v2/analytics/grid/report/diurnal", methods=['POST'])
def air_quality_data_diurnal_route():
    return air_quality_data_diurnal()  # Call the air_quality_data_diurnal function

if __name__ == "__main__":
    app.run()
