from api.models.base.base_model import BasePyMongoModel

from main import cache


class ExceedanceModel(BasePyMongoModel):
    def __init__(self, tenant):
        super().__init__(tenant, collection_name="exceedances")

    def group_by_pollutant(self, pollutant, standard):
        if str(standard).lower() == 'who':
            return self.group(
                _id="$site_id",
                site={"$first": "$site"},
                **{f"{pollutant}": {"$avg": f"$who.{pollutant}"}},
                totalRaw={"$avg": "$who.total"},
            )

        return self.group(
            _id="$site_id",
            site={"$first": "$site"},
            Good={"$avg": f"$aqi.{pollutant}.Good"},
            Moderate={"$avg": f"$aqi.{pollutant}.Moderate"},
            UHFSG={"$avg": f"$aqi.{pollutant}.UHFSG"},
            Unhealthy={"$avg": f"$aqi.{pollutant}.Unhealthy"},
            VeryUnhealthy={"$avg": f"$aqi.{pollutant}.VeryUnhealthy"},
            Hazardous={"$avg": f"$aqi.{pollutant}.Hazardous"},
            totalRaw={"$avg": "$aqi.total"},
        )

    def add_fields_by_pollutant(self, pollutant, standard):
        if str(standard).lower() == 'who':
            return self.add_fields(
                total={"$round": "$totalRaw"},
                exceedance={"$round": f"${pollutant}"},
            )

        return self.add_fields(
            total={"$round": "$totalRaw"},
            exceedance={
                "Good": {"$round": "$Good"},
                "Moderate": {"$round": "$Moderate"},
                "UHFSG": {"$round": "$UHFSG"},
                "Unhealthy": {"$round": "$Unhealthy"},
                "VeryUnhealthy": {"$round": "$VeryUnhealthy"},
                "Hazardous": {"$round": "$Hazardous"},
            },
        )

    def project_by_standard(self, standard):
        if str(standard).lower() == 'who':
            return self.project(site_id={"$toObjectId": "$site_id"}, who=1)
        return self.project(site_id={"$toObjectId": "$site_id"}, aqi=1)


    @cache.memoize()
    def get_exceedances(self, start_date, end_date, pollutant, standard):
        return (
            self
                .date_range("exceedances.time", start_date=start_date, end_date=end_date)
                .unwind("exceedances")
                .replace_root("exceedances")
                .project_by_standard(standard)
                .lookup("sites", local_field="site_id", foreign_field="_id", col_as="site")
                .group_by_pollutant(pollutant, standard)
                .add_fields_by_pollutant(pollutant, standard)
                .unwind("site")
                .project(
                    _id=0,
                    total=1,
                    exceedance=1,
                    site={"name": 1, "description": 1, "generated_name": 1},
                )
                .exec()
        )
