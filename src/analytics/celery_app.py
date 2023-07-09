import logging
import traceback
from datetime import timedelta

from celery.utils.log import get_task_logger
from flask import Flask
from flask_caching import Cache
from flask_pymongo import PyMongo

from celery import Celery

from config import Config, CONFIGURATIONS
from api.models import DataExportModel, DataExportStatus, DataExportRequest, EventsModel

celery_logger = get_task_logger(__name__)
_logger = logging.getLogger(__name__)

# db initialization
mongo = PyMongo()
cache = Cache()


def create_app():
    application = Flask(__name__)
    application.config.from_object(CONFIGURATIONS)
    mongo.init_app(application)
    cache.init_app(application)
    return application


def make_celery():
    config = {
        "broker_url": f"{Config.CACHE_REDIS_URL}/0",
        "result_backend": f"{Config.CACHE_REDIS_URL}/0",
        "task_default_queue": "analytics",
        "beat_schedule": {
            "data_export_periodic_task": {
                "task": "data_export_periodic_task",
                "schedule": timedelta(seconds=5),
            }
        },
        "app_name": "data_export",
    }

    celery_application = Celery(config["app_name"], broker=config["broker_url"])
    celery_application.conf.update(config)
    return celery_application


celery = make_celery()


@celery.task(name="data_export_periodic_task")
def data_export_task():
    celery_logger.info("Data export periodic task running")

    data_export_model = DataExportModel()
    scheduled_requests: [
        DataExportRequest
    ] = data_export_model.get_scheduled_and_failed_requests()

    if len(scheduled_requests) == 0:
        celery_logger.info("No data for processing")
        return
    else:
        celery_logger.info(f"Commenced processing {len(scheduled_requests)} request(s)")

    requests_for_processing: [DataExportRequest] = []

    for request in scheduled_requests:
        request.status = DataExportStatus.PROCESSING
        success = data_export_model.update_request_status_and_retries(request)
        if success:
            requests_for_processing.append(request)

    for request in requests_for_processing:
        try:
            query = EventsModel.data_export_query(
                sites=request.sites,
                devices=request.devices,
                airqlouds=request.airqlouds,
                start_date=request.start_date,
                end_date=request.end_date,
                frequency=request.frequency.value,
                pollutants=request.pollutants,
            )

            has_data = data_export_model.has_data(query)

            if not has_data:
                request.status = DataExportStatus.NO_DATA
                data_export_model.update_request_status_and_retries(request)
                continue

            data_export_model.export_query_results_to_table(
                query=query, export_request=request
            )
            data_export_model.export_table_to_gcs(export_request=request)
            data_links: [str] = data_export_model.get_data_links(export_request=request)

            request.data_links = data_links
            request.status = DataExportStatus.READY

            success = data_export_model.update_request_status_and_data_links(request)

            if not success:
                raise Exception("Update failed")

        except Exception as ex:
            print(ex)
            traceback.print_exc()
            request.status = DataExportStatus.FAILED
            request.retries = request.retries - 1
            data_export_model.update_request_status_and_retries(request)

        celery_logger.info(
            f"Finished processing {len(requests_for_processing)} request(s)"
        )


if __name__ == "__main__":
    data_export_task()
