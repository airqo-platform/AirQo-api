import pandas as pd

from .constants import Pollutant
from .utils import Utils


class AirQualityUtils:
    @staticmethod
    def add_categorisation(data: pd.DataFrame) -> pd.DataFrame:
        if "pm2_5" in list(data.columns):
            data["pm2_5_category"] = data["pm2_5"].apply(
                lambda x: Utils.epa_pollutant_category(
                    pollutant=Pollutant.PM2_5, value=x
                )
            )

        if "pm10" in list(data.columns):
            data["pm10_category"] = data["pm10"].apply(
                lambda x: Utils.epa_pollutant_category(
                    pollutant=Pollutant.PM10, value=x
                )
            )

        if "no2" in list(data.columns):
            data["no2_category"] = data["no2"].apply(
                lambda x: Utils.epa_pollutant_category(pollutant=Pollutant.NO2, value=x)
            )

        return data
