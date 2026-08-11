"""
Celery worker for scheduled data exports.

Beat schedules ``data_export_periodic_task`` every 5 seconds; the worker
picks SCHEDULED (and retryable FAILED) requests from MongoDB, builds a
BigQuery export query, materialises the results into a destination table,
extracts it to GCS, and writes the download links back onto the Mongo
document (status READY).  There is no email step — consumers poll
``GET /data-export?userId=``.

Runs entirely on config (no Flask).  Redis is the broker/result
backend only.  Note: the 5s beat has no distributed lock — the
SCHEDULED→PROCESSING status flip is the only double-processing guard.
"""

import logging
import traceback
from datetime import timedelta
from typing import List

from celery import Celery
from celery.utils.log import get_task_logger

from api.models.data_export import DataExportModel, DataExportRequest
from api.models.export_queries import data_export_query
from config import settings
from constants import DataExportStatus

celery_logger = get_task_logger(__name__)
_logger = logging.getLogger(__name__)


def make_celery():
    config = {
        "broker_url": f"{settings.cache_redis_url}/0",
        "result_backend": f"{settings.cache_redis_url}/0",
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
    pending_requests = data_export_model.get_scheduled_and_failed_requests()

    if len(pending_requests) == 0:
        celery_logger.info("No data for processing")
        return
    else:
        celery_logger.info(f"Commenced processing {len(pending_requests)} request(s)")

    requests_for_processing: List[DataExportRequest] = []

    for request in pending_requests:
        request.status = DataExportStatus.PROCESSING
        success = data_export_model.update_request_status_and_retries(request)
        if success:
            requests_for_processing.append(request)

    for request in requests_for_processing:
        try:
            # frequency is passed as the enum — data_export_query resolves
            # .value itself (the old worker passed a string into code that
            # called .value again, crashing every request).
            query = data_export_query(
                filter_type=request.filter_type,
                filter_value=request.filter_value,
                start_date=request.start_date,
                end_date=request.end_date,
                frequency=request.frequency,
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
            data_links: List[str] = data_export_model.get_data_links(
                export_request=request
            )

            request.data_links = data_links
            request.status = DataExportStatus.READY

            success = data_export_model.update_request_status_and_data_links(request)

            if not success:
                raise Exception("Update failed")

        except Exception as ex:
            _logger.error(f"Export request {request.request_id} failed: {ex}")
            traceback.print_exc()
            request.status = DataExportStatus.FAILED
            request.retries = request.retries - 1
            data_export_model.update_request_status_and_retries(request)

    celery_logger.info(f"Finished processing {len(requests_for_processing)} request(s)")


if __name__ == "__main__":
    data_export_task()
