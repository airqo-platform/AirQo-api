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

    @cache.memoize()
    def get_downloadable_events(self, sites, start_date, end_date, frequency, pollutants):
        return (
            self.date_range("values.time", start_date=start_date, end_date=end_date)
                .project(**{'values.site_id': 1, 'values.time': 1}, **pollutants)
                .filter_by(**{"values.frequency": frequency})
                .unwind("values")
                .replace_root("values")
                .project(
                    _id=0,
                    time={"$toString": "$time"},
                    pm2_5="$pm2_5.value",
                    pm10="$pm10.value",
                    no2="$no2.value",
                    frequency=1,
                    site_id={"$toString": "$site_id"}
                )
                .match_in(site_id=sites)
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
                        "value": "$value"
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