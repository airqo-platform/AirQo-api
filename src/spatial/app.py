# app.py
from flask import Flask
from flask_cors import CORS
from controllers.controllers import controller_bp

app = Flask(__name__)
CORS(app)
app.register_blueprint(controller_bp, url_prefix='/api/v2/spatial')

if __name__ == '__main__':
    app.run()
