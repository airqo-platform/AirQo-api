from api.models.base.base_model import BasePyMongoModel


class ExceedanceModel(BasePyMongoModel):
    def __init__(self, tenant):
        super().__init__(tenant, collection_name="exceedances")

    def group_by_pollutant(self, pollutant, standard):
        if str(standard).lower() == 'who':
            return self.group(
                _id="$site_id",
                **{f"{pollutant}": {"$avg": f"$who.{pollutant}"}},
            )

        return self.group(
            _id="$site_id",
            Good={"$avg": f"$aqi.{pollutant}.Good"},
            Moderate={"$avg": f"$aqi.{pollutant}.Moderate"},
            UHFSG={"$avg": f"$aqi.{pollutant}.UHFSG"},
            Unhealthy={"$avg": f"$aqi.{pollutant}.Unhealthy"},
            VeryUnhealthy={"$avg": f"$aqi.{pollutant}.VeryUnhealthy"},
            Hazardous={"$avg": f"$aqi.{pollutant}.Hazardous"},
            total={"$avg": "$aqi.total"},
        )

    def add_field_by_pollutant(self, pollutant, standard):
        if str(standard).lower() == 'who':
            return self.add_fields(

                who={
                    "total": {"$round": "$total"},
                    f"{pollutant}": {"$round": f"${pollutant}"},
                },
            )

        return self.add_fields(
            aqi={
                "total": {"$round": "$total"},
                f"{pollutant}": {
                    "Good": {"$round": "$Good"},
                    "Moderate": {"$round": "$Moderate"},
                    "UHFSG": {"$round": "$UHFSG"},
                    "Unhealthy": {"$round": "$Unhealthy"},
                    "VeryUnhealthy": {"$round": "$VeryUnhealthy"},
                    "Hazardous": {"$round": "$Hazardous"},
                }
            },
        )

    def get_exceedances(self, start_date, end_date, pollutant, standard):
        return (
            self
                .date_range("exceedances.time", start_date=start_date, end_date=end_date)
                .unwind("exceedances")
                .replace_root("exceedances")
                .group_by_pollutant(pollutant, standard)
                .add_field_by_pollutant(pollutant, standard)
                .project(site_id={"$toString": "$_id"}, total=1, who=1, aqi=1)
                .exec()
        )