from api.models.base.base_model import BasePyMongoModel


class ExceedanceModel(BasePyMongoModel):
    def __init__(self, tenant):
        super().__init__(tenant, collection_name="exceedances")

    def get_exceedances(self, start_date, end_date, pollutant, standard):
        return (
            self
                .date_range("exceedances.time", start_date=start_date, end_date=end_date)
                .unwind("exceedances")
                .replace_root("exceedances")
                .project(site_id={"$toString": "$site_id"}, who=1, aqi=1)
                .group(
                    _id="site_id",
                    who={
                        "pm2_5": {"$round": {"$avg": "$who.pm2_5"}},
                        "pm10": {"$round": {"$avg": "$who.pm10"}},
                        "no2": {"$round": {"$avg": "$who.no2"}},
                    },
                    aqi={
                        "pm2_5": {
                            "Good": {"$round": {"$avg": "$aqi.pm2_5.Good"}},
                            "Moderate": {"$round": {"$avg": "$aqi.pm2_5.Moderate"}},
                            "UNFSG": {"$round": {"$avg": "$aqi.pm2_5.UNFSG"}},
                            "Unhealthy": {"$round": {"$avg": "$aqi.pm2_5.Unhealthy"}},
                            "VeryUnhealthy": {"$round": {"$avg": "$aqi.pm2_5.VeryUnhealthy"}},
                            "Hazardous": {"$round": {"$avg": "$aqi.pm2_5.Hazardous"}},
                        },
                        "pm10": {
                            "Good": {"$round": {"$avg": "$aqi.pm10.Good"}},
                            "Moderate": {"$round": {"$avg": "$aqi.pm10.Moderate"}},
                            "UNFSG": {"$round": {"$avg": "$aqi.pm10.UNFSG"}},
                            "Unhealthy": {"$round": {"$avg": "$aqi.pm10.Unhealthy"}},
                            "VeryUnhealthy": {"$round": {"$avg": "$aqi.pm10.VeryUnhealthy"}},
                            "Hazardous": {"$round": {"$avg": "$aqi.pm10.Hazardous"}},
                        },
                        "no2": {
                            "Good": {"$round": {"$avg": "$aqi.no2.Good"}},
                            "Moderate": {"$round": {"$avg": "$aqi.no2.Moderate"}},
                            "UNFSG": {"$round": {"$avg": "$aqi.no2.UNFSG"}},
                            "Unhealthy": {"$round": {"$avg": "$aqi.no2.Unhealthy"}},
                            "VeryUnhealthy": {"$round": {"$avg": "$aqi.no2.VeryUnhealthy"}},
                            "Hazardous": {"$round": {"$avg": "$aqi.no2.Hazardous"}},
                        },
                    }
                )
                .exec()
        )