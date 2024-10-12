from flask import Flask, make_response
from flask_cors import CORS
from controllers.controllers import controller_bp

app = Flask(__name__)
CORS(app)
app.register_blueprint(controller_bp, url_prefix="/api/v2/spatial")


# Add custom CORS header
@app.after_request
def add_cors_headers(response):
    response.headers[
        "Access-Control-Allow-Origin"
    ] = "*"  # You can specify specific origins instead of '*'
    response.headers[
        "Access-Control-Allow-Headers"
    ] = "Content-Type, Authorization, X-Requested-With, X-Auth-Token"
    response.headers["Access-Control-Allow-Methods"] = "GET,PUT,POST,DELETE,OPTION"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


# Define your own blueprints with business logic
@app.route("/test", methods=["GET"])
def test():
    return "Test success"


if __name__ == "__main__":
    app.run()
