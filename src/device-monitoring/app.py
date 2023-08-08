import logging
import os
import traceback
from datetime import timedelta

from celery import Celery
from celery.utils.log import get_task_logger
from flask import Flask, jsonify
from flask_caching import Cache
from flask_cors import CORS
from flask_pymongo import PyMongo
from werkzeug.exceptions import NotFound, MethodNotAllowed

from config import constants
from config.constants import Config
from helpers.pre_request import PreRequest

celery_logger = get_task_logger(__name__)
_logger = logging.getLogger(__name__)

# db initialization
mongo = PyMongo()
cache = Cache()


def create_app(environment):
    # create a flask app instance
    application = Flask(__name__)

    application.config.from_object(constants.app_config[environment])

    mongo.init_app(application)
    cache.init_app(application)

    # Allow cross-browser resource sharing
    CORS(application)

    # import blueprints
    from controllers.check_health import health_check_bp
    from controllers.check_status import device_status_bp
    from controllers.uptime_controller import uptime_bp
    from controllers.collocation import collocation_bp

    # register blueprints
    application.register_blueprint(health_check_bp)
    application.register_blueprint(device_status_bp)
    application.register_blueprint(uptime_bp)
    application.register_blueprint(collocation_bp)

    return application


app = create_app(os.getenv("FLASK_ENV"))


def make_celery(application):
    application.config["broker_url"] = f"{Config.REDIS_URL}/0"
    application.config["result_backend"] = f"{Config.REDIS_URL}/0"
    application.config["task_default_queue"] = "collocation"
    application.config["beat_schedule"] = {
        "collocation_periodic_task": {
            "task": "collocation_periodic_task",
            "schedule": timedelta(minutes=Config.COLLOCATION_CELERY_MINUTES_INTERVAL),
        }
    }

    celery_app = Celery(
        application.import_name, broker=application.config["broker_url"]
    )
    celery_app.conf.update(application.config)
    task_base = celery_app.Task

    class ContextTask(task_base):
        abstract = True

        def __call__(self, *args, **kwargs):
            with application.app_context():
                return task_base.__call__(self, *args, **kwargs)

    celery_app.Task = ContextTask
    return celery_app


celery = make_celery(app)


@celery.task(name="collocation_periodic_task")
def collocation_periodic_task():
    celery_logger.info("Collocation periodic task running")
    from helpers.collocation import Collocation
    from models.collocation import CollocationBatch

    collocation = Collocation()
    collocation.update_batches_statues()
    running_batches: list[CollocationBatch] = collocation.get_running_batches()
    collocation.compute_and_update_results(running_batches)
    collocation.update_batches_statues()


@app.errorhandler(Exception)
def handle_exception(error):
    traceback.print_exc()
    print(error)
    return jsonify({"message": "Error occurred. Contact support"}), 500


@app.errorhandler(NotFound)
def handle_404_exception(error):
    print(error)
    return jsonify({"message": "Requested Url not found on this service"}), 404


@app.errorhandler(MethodNotAllowed)
def handle_405_exception(error):
    print(error)
    return jsonify({"message": "Method not allowed for this endpoint."}), 405


@app.before_request
def check_tenant_param():
    return PreRequest.check_tenant()


if __name__ == "__main__":
    app.run()
