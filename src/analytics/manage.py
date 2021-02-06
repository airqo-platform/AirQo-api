"""Module Application entry point"""

# Third-Party libraries
import click
from flask import jsonify
from decouple import config as env_config

# Config
from main import create_app
from config import config

# models
# from api.models.database import db


config_name = env_config('FLASK_ENV', 'production')

app = create_app(config=config[config_name])


@app.route('/health')
def index():
    return jsonify(dict(message=f'App status - OK.'))


if __name__ == '__main__':
    app.run()
