from api.models.base.base_model import BasePyMongoModel


class EventsModel(BasePyMongoModel):
    def __init__(self, tenant):
        super().__init__(tenant, collection_name="events")

    def get_downloadable_events(self, sites, start_date, end_date, frequency, pollutants):
        return (
            self.date_range("values.time", start_date=start_date, end_date=end_date)
                .filter_by(**{"values.frequency": frequency})
                .unwind("values")
                .replace_root("values")
                .project(
                    _id=0,
                    time={"$toString": "$time"},
                    **pollutants,
                    frequency=1,
                    site_id={"$toString": "$site_id"}
                )
                .match_in(site_id=sites)
                .exec()
        )

    def get_events(self, sites, start_date, end_date, frequency):
        return (
            self
                .date_range("values.time", start_date=start_date, end_date=end_date)
                .filter_by(**{"values.frequency": frequency})
                .unwind("values")
                .replace_root("values")
                .project(
                    _id=0,
                    time={"$toString": "$time"},
                    **{"pm2_5.value": 1},
                    **{"pm10.value": 1},
                    **{"no2.value": 1},
                    frequency=1,
                    site_id={"$toString": "$site_id"}
                )
                .match_in(site_id=sites)
                .group(
                    _id="$site_id",
                    frequency={'$first': "$frequency"},
                    site_reading={
                        '$push': {
                            'time': '$time',
                            'pm2_5': '$pm2_5.value',
                            'pm10': '$pm10.value',
                            'no2': '$no2.value'
                        }
                    }
                )
                .exec()
        )