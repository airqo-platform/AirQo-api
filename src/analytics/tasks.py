from datetime import datetime

from celery import shared_task
from celery.utils.log import get_task_logger
from google.cloud import storage

from models import EventsModel
from utils.data_formatters import format_to_aqcsv

# TODO: Look into using flower to monitor tasks
celery_logger = get_task_logger(__name__)


@shared_task(bind=True, name="tasks.export_data", ignore_result=False)
def export_data(
    self,
    devices,
    sites,
    airqlouds,
    start_date,
    end_date,
    frequency,
    pollutants,
    output_format,
    weather_fields,
    export_format,
    meta_data,
    user_id,
):
    try:
        celery_logger.info("Exporting data")
        dataframe = EventsModel.download_from_bigquery(
            devices=devices,
            sites=sites,
            airqlouds=airqlouds,
            start_date=start_date,
            end_date=end_date,
            frequency=frequency,
            pollutants=pollutants,
            weather_fields=weather_fields,
        )
        if output_format == "aqcsv":
            dataframe = format_to_aqcsv(
                dataframe,
                frequency=frequency,
                pollutants=pollutants,
            )

        filename = f'{user_id}_{datetime.now().strftime("%Y%m%d%H%M%S")}.csv'
        client = storage.Client()
        bucket = client.bucket(bucket_name="data_export_datasets")
        blob = bucket.blob(filename)
        blob.upload_from_string(dataframe.to_csv(index=False), "text/csv")

        file_url = blob.public_url

        celery_logger.info("Data export completed successfully")
        return file_url

    except Exception as e:
        celery_logger.error(f"Error while exporting data: {e}")
