from datetime import datetime

from celery import shared_task
from celery.utils.log import get_task_logger
from google.cloud import storage

from models import EventsModel

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
                pollutants=pollutants
            )
            filename = f'{user_id}_{datetime.now().strftime("%Y%m%d%H%M%S")}.csv'
            client = storage.Client()
            bucket = client.bucket('your_bucket_name')
            blob = bucket.blob(filename)
            blob.upload_from_string(dataframe.to_csv(index=False), 'text/csv')

            # Save task status
            file_url = blob.public_url

            return file_url

        except Exception as e:
            return e


