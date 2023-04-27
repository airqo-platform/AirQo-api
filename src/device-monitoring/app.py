from datetime import timedelta
from flask import Flask
from celery import Celery
from celery.utils.log import get_task_logger
import logging
import os
from flask_caching import Cache
from flask_cors import CORS
from flask_pymongo import PyMongo
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
    from controllers.collocation import collocation_bp

    # register blueprints
    application.register_blueprint(health_check_bp)
    application.register_blueprint(device_status_bp)
    application.register_blueprint(collocation_bp)

    return application


app = create_app(os.getenv("FLASK_ENV"))


def make_celery(application):
    application.config["broker_url"] = f"{Config.REDIS_URL}/0"
    application.config["result_backend"] = f"{Config.REDIS_URL}/0"
    application.config["beat_schedule"] = {
        "collocation_periodic_task": {
            "task": "collocation_periodic_task",
            "schedule": timedelta(seconds=5),
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
def collocation_task():
    celery_logger.info("Collocation periodic task running")
    from helpers.collocation import CollocationScheduling

    scheduling = CollocationScheduling()
    scheduling.run_scheduled_collocated_devices()
    scheduling.update_scheduled_status()


@app.before_request
def check_tenant_param():
    return PreRequest.check_tenant()


if __name__ == "__main__":
    app.run()
