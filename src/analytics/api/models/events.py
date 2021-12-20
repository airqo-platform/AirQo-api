import pytz
from datetime import datetime
from api.models.base.base_model import BasePyMongoModel

from main import cache


class EventsModel(BasePyMongoModel):
    def __init__(self, tenant):
        self.limit_mapper = {
            'pm2_5': 500.5,
            'pm10': 604.5,
            'no2': 2049
        }
        super().__init__(tenant, collection_name="events")

    def remove_outliers(self, pollutant):
        return self.add_stages(
            [
                {
                    '$match': {
                        f'{pollutant}.value': {'$gte': 0, '$lte': self.limit_mapper[pollutant]}
                    }
                }
            ]
        )

    @staticmethod
    def _format_pollutants( pollutants):
        range_format = {}
        group_format = {}

        for pollutant in pollutants:
            range_format[f'values.{pollutant}.value'] = 1
            group_format[pollutant] = {"$avg": f'${pollutant}'}

        return range_format, group_format

    @staticmethod
    def _project_pollutant_filter(pollutants):
        filtered = {}

        for pollutant in pollutants:
            filtered[pollutant] = {'$round': [f'${pollutant}', 2]}

        return filtered

    @cache.memoize()
    def get_downloadable_events(self, sites, start_date, end_date, frequency, pollutants):
        time_format_mapper = {
            'raw': '%Y-%m-%dT%H:%M:%S%z',
            'hourly': '%Y-%m-%d %H:00',
            'daily': '%Y-%m-%d',
            'monthly': '%Y-%m-01'
        }
        range_format, group_format = self._format_pollutants(pollutants)

        return (
            self.date_range("values.time", start_date=start_date, end_date=end_date)
                .project(**{'values.site_id': 1, 'values.time': 1, "values.frequency": 1}, **range_format)
                .filter_by(**{"values.frequency": 'raw'})
                .unwind("values")
                .replace_root("values")
                .project(
                    _id=0,
                    time={
                        "$dateToString": {
                            'format': time_format_mapper.get(frequency) or time_format_mapper.get('hourly'),
                            'date': '$time',
                            'timezone': 'Africa/Kampala'
                        }
                    },
                    pm2_5="$pm2_5.value",
                    pm10="$pm10.value",
                    no2="$no2.value",
                    frequency=1,
                    site_id={"$toString": "$site_id"}
                )
                .match_in(site_id=sites)
                .group(
                    _id={"site_id": "$site_id", "time": "$time"},
                    time={"$first": "$time"},
                    **group_format,
                    site_id={"$first": "$site_id"}
                )
                .project(site_id={"$toObjectId": "$site_id"}, time=1, pm2_5=1, pm10=1, no2=1)
                .lookup("sites", local_field="site_id", foreign_field="_id", col_as="site")
                .unwind('site')
                .sort(time=self.ASCENDING)
                .project(
                    _id=0,
                    time=1,
                    **self._project_pollutant_filter(pollutants),
                    frequency={"$literal": frequency},
                    site_id={"$toString": "$site_id"},
                    site_name="$site.name",
                    site_description="$site.description",
                    latitude="$site.latitude",
                    longitude="$site.longitude",
                )

                .exec()
        )

    @cache.memoize()
    def get_averages_by_pollutant(self, start_date, end_date, pollutant):
        return (
            self
                .date_range("values.time", start_date=start_date, end_date=end_date)
                .filter_by(**{"values.frequency": "raw"})
                .unwind("values")
                .replace_root("values")
                .project(
                    _id=0,
                    **{f"{pollutant}":1},
                    site_id={"$toString": "$site_id"},
                )
                .remove_outliers(pollutant)
                .group(
                    _id="$site_id",
                    site_id={"$first": "$site_id"},
                    value={"$avg": f"${pollutant}.value"},
                )
                .project(_id=0, site_id=1, value={"$round": "$value"})
                .exec()

        )

    @cache.memoize()
    def get_chart_events(self, sites, start_date, end_date, pollutant, frequency):
        time_format_mapper = {
            'raw': '%Y-%m-%dT%H:%M:%S%z',
            'hourly': '%Y-%m-%d %H:00',
            'daily': '%Y-%m-%d',
            'monthly': '%Y-%m-01'
        }

        return (
            self
                .project(**{"values.time": 1, "values.site_id": 1, f"values.{pollutant}": 1})
                .date_range("values.time", start_date=start_date, end_date=end_date)
                .filter_by(**{"values.frequency": "raw"})
                .unwind("values")
                .replace_root("values")
                .project(
                    _id=0,
                    time={
                        "$dateToString": {
                            'format': time_format_mapper.get(frequency) or time_format_mapper.get('hourly'),
                            'date': '$time',
                            'timezone': 'Africa/Kampala'
                        }
                    },
                    **{f"{pollutant}.value": 1},
                    site_id={"$toString": "$site_id"},
                )
                .remove_outliers(pollutant)
                .match_in(site_id=sites)
                .group(
                    _id={"site_id": "$site_id", "time": "$time"},
                    time={"$first": "$time"},
                    value= {"$avg": f"${pollutant}.value"},
                )
                .group(
                    _id="$_id.site_id",
                    values={"$push": {
                        "time": "$time",
                        "value": {"$round": ["$value", 2]},
                    }},
                )
                .project(site_id={"$toObjectId": "$_id"}, values=1)
                .lookup("sites", local_field="site_id", foreign_field="_id", col_as="site")
                .project(
                    _id=1,
                    site_id={"$toString": "$_id"},
                    values=1, site={"name": 1, "description": 1, "generated_name": 1}
                )
                .unwind("site")
                .exec()
        )

    @cache.memoize()
    def get_d3_chart_events(self, sites, start_date, end_date, pollutant, frequency):
        time_format_mapper = {
            'raw': '%Y-%m-%dT%H:%M:%S%z',
            'hourly': '%Y-%m-%dT%H:00:00%z',
            'daily': '%Y-%m-%dT00:00:00%z',
            'monthly': '%Y-%m-01T00:00:00%z',
            'diurnal': f'{datetime.now(pytz.utc).strftime("%Y-%m-%d")}T%H:00:00%z',
        }

        return (
            self
                .project(**{"values.time": 1, "values.site_id": 1, f"values.{pollutant}": 1})
                .date_range("values.time", start_date=start_date, end_date=end_date)
                .match_in(**{"values.site_id": self.to_object_ids(sites)})
                .filter_by(**{"values.frequency": "raw"})
                .unwind("values")
                .replace_root("values")
                .project(
                    _id=0,
                    time={
                        "$dateToString": {
                            'format': time_format_mapper.get(frequency) or time_format_mapper.get('hourly'),
                            'date': '$time',
                            'timezone': 'Africa/Kampala'
                        }
                    },
                    **{f"{pollutant}.value": 1},
                    site_id={"$toString": "$site_id"},
                )
                .remove_outliers(pollutant)
                .group(
                    _id={"site_id": "$site_id", "time": "$time"},
                    time={"$first": "$time"},
                    site_id={"$first": "$site_id"},
                    value={"$avg": f"${pollutant}.value"},
                )
                .sort(time=self.ASCENDING)
                .project(_id=0, site_id={"$toObjectId": "$site_id"}, time=1,value=1)
                .lookup("sites", local_field="site_id", foreign_field="_id", col_as="site")
                .project(
                    _id=0,
                    time=1,
                    value={"$round": ["$value", 2]},
                    site_id={"$toString": "$site_id"},
                    name="$site.name",
                    generated_name="$site.generated_name",
                )
                .unwind("name")
                .unwind("generated_name")
                .exec()
        )

    def get_events(self, sites, start_date, end_date, frequency):
        time_format_mapper = {
            'raw': '%Y-%m-%dT%H:%M:%S%z',
            'hourly': '%Y-%m-%d %H:00',
            'daily': '%Y-%m-%d',
            'monthly': '%Y-%m-01'
        }

        return (
            self
                .date_range("values.time", start_date=start_date, end_date=end_date)
                .filter_by(**{"values.frequency": "raw"})
                .unwind("values")
                .replace_root("values")
                .lookup("sites", local_field="site_id", foreign_field="_id", col_as="sites")
                .project(
                    _id=0,
                    time={
                        "$dateToString": {
                            'format': time_format_mapper.get(frequency) or time_format_mapper.get('hourly'),
                            'date': '$time',
                            'timezone': 'Africa/Kampala'
                        }
                    },
                    **{"pm2_5.value": 1},
                    **{"pm10.value": 1},
                    **{"no2.value": 1},
                    frequency=1,
                    site_id={"$toString": "$site_id"},
                    sites={"name": 1, "description": 1, "generated_name": 1}
                )
                .match_in(site_id=sites)
                .group(
                    _id={"site_id": "$site_id", "time": "$time"},
                    frequency={'$first': "$frequency"},
                    pm2_5={"$avg": "$pm2_5.value"},
                    pm10={"$avg": "$pm10.value"},
                    no2={"$avg": "$no2.value"},
                    sites={'$first': "$sites"}
                )
                .sort(**{"_id.time": 1})
                .exec()
        )