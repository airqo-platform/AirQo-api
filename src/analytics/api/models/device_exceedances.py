from datetime import datetime

from api.models.base.base_model import BasePyMongoModel
from api.utils.dates import date_to_str, str_to_date


class DeviceDailyExceedances(BasePyMongoModel):
    def __init__(self, tenant):
        super().__init__(tenant, collection_name="device_daily_exceedences")

    def get_last_28_days_exceedences(self, pollutant='PM 2.5', standard='AQI'):
        """
        Gets all the exceedences for all the locations in the past 28 days from current day.

        Args:
            pollutant: the pollutant whose exceedences are to be returned.
            standard: the standard to use to get the exceedences.

        Returns:
            A list of the number of daily exceedences for the specified pollutant and standard in the past 28 days.
        """
        created_at = str_to_date(date_to_str(datetime.now().date()))

        query = {
            '$match': {
                'created_at': {'$gte': created_at},
                'pollutant': pollutant, 'standard': standard
            }
        }
        projection = {'$project': {'_id': 0}}
        return list(self.collection.aggregate([query, projection]))
