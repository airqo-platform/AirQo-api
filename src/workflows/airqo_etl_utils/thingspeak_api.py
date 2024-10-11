import json

import pandas as pd
import requests

from .config import configuration
import logging

logger = logging.getLogger(__name__)


class ThingspeakApi:
    def __init__(self):
        self.THINGSPEAK_CHANNEL_URL = configuration.THINGSPEAK_CHANNEL_URL

    def query_data(
        self,
        device_number: int,
        start_date_time: str,
        end_date_time: str,
        read_key: str,
    ) -> pd.DataFrame:
        data = pd.DataFrame([])

        try:
            url = f"{self.THINGSPEAK_CHANNEL_URL}{device_number}/feeds.json?start={start_date_time}&end={end_date_time}&api_key={read_key}"
            print(f"{url}")

            response = json.loads(
                requests.get(url, timeout=100.0).content.decode("utf-8")
            )

            if (response != -1) and ("feeds" in response):
                data = pd.DataFrame(response["feeds"])
                data.attrs["meta_data"] = response["channel"]

        except Exception as ex:
            logger.exception(f"An error occured: {ex}")

        return data
