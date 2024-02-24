# app.py
from flask import Flask
from controller.controllers import controller_bp


app = Flask(__name__)

# Register the controller blueprint
app.register_blueprint(controller_bp, url_prefix='/api/v2/spatial')

if __name__ == '__main__':
    app.run()
