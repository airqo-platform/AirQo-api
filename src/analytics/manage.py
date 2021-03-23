"""Module Application entry point"""

# Third-Party libraries
from flasgger import swag_from
from flask import jsonify
from decouple import config as env_config

# Config
from main import create_app, rest_api
from config import config

#utils
from api.utils.pre_request import PreRequest

# models
# from api.models.database import db


config_name = env_config('FLASK_ENV', 'production')

app = create_app(rest_api, config=config[config_name])


@app.before_request
def check_tenant_param():
    return PreRequest.check_tenant()


@app.route('/health')
@swag_from('/api/docs/status.yml')
def index():
    return jsonify(dict(message=f'App status - OK.'))

# x = [r for r in app.url_map.iter_rules()]
# print("all usrls", x)
# pri
# print("all rules", [r.rule for r in app.url_map.iter_rules()])



if __name__ == '__main__':
    app.run()
