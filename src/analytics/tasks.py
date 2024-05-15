from datetime import datetime

from celery import shared_task
from celery.utils.log import get_task_logger
from google.auth import service_account
from google.cloud import storage

from config import config
from models import EventsModel
from utils.data_formatters import format_to_aqcsv

celery_logger = get_task_logger(__name__)


@shared_task(bind=True, name="data_export_periodic_task")
def export_data(
    devices,
    sites,
    airqlouds,
    start_date,
    end_date,
    frequency,
    pollutants,
    output_format,
    user_id,
):
    try:
        dataframe = EventsModel.download_from_bigquery(
            devices=devices,
            sites=sites,
            airqlouds=airqlouds,
            start_date=start_date,
            end_date=end_date,
            frequency=frequency,
            pollutants=pollutants,
        )
        if output_format == "aqcsv":
            dataframe = format_to_aqcsv(
                dataframe,
                frequency=frequency,
                pollutants=pollutants,
            )

        filename = f'{user_id}_{datetime.now().strftime("%Y%m%d%H%M%S")}.csv'
        client = storage.Client(
            project=config.DATA_EXPORT_GCP_PROJECT, credentials=service_account.Credentials.from_service_account_file(
            config.DATA_EXPORT_GCP_CREDENTIALS,
        ))
        bucket = client.bucket(config.DATA_EXPORT_BUCKET)
        blob = bucket.blob(filename)
        blob.upload_from_string(dataframe.to_csv(index=False), "text/csv")

        file_url = blob.public_url

        return file_url

    except Exception as e:
        return e
