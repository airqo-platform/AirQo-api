from api.models.base.base_model import BasePyMongoModel
from main import cache


class ExceedanceModel(BasePyMongoModel):
    standards_mapping = {
        "aqi": {
            "pm2_5": {
                "Good": [0, 12],
                "Moderate": [12.1, 35.4],
                "UHFSG": [35.5, 55.4],
                "Unhealthy": [55.5, 150.4],
                "VeryUnhealthy": [150.5, 250.4],
                "Hazardous": [250.5, 500.4],
            },
            "pm10": {
                "Good": [0, 54],
                "Moderate": [55, 154],
                "UHFSG": [155, 254],
                "Unhealthy": [255, 354],
                "VeryUnhealthy": [355, 424],
                "Hazardous": [425, 604],
            },
        },
        "who": {
            "pm2_5": {
                "Good": [0, 10],
                "Moderate": [11, 25],
                "UHFSG": [26, 50],
                "Unhealthy": [51, 90],
                "VeryUnhealthy": [91, 120],
                "Hazardous": [121, 250],
            },
            "pm10": {
                "Good": [0, 20],
                "Moderate": [21, 50],
                "UHFSG": [51, 90],
                "Unhealthy": [91, 150],
                "VeryUnhealthy": [151, 250],
                "Hazardous": [251, 350],
            },
        },
    }

    def __init__(self, tenant):
        super().__init__(tenant, collection_name="exceedances")

    def group_by_pollutant(self, pollutant, standard):
        if str(standard).lower() == "who":
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
        if str(standard).lower() == "who":
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
        if str(standard).lower() == "who":
            return self.project(site_id={"$toObjectId": "$site_id"}, who=1)
        return self.project(site_id={"$toObjectId": "$site_id"}, aqi=1)

    @cache.memoize()
    def get_exceedances(self, start_date, end_date, pollutant, standard, sites=None):
        if sites:
            return self.get_exceedances_by_sites(
                start_date, end_date, pollutant, standard, sites
            )
        return (
            self.date_range(
                "exceedances.time", start_date=start_date, end_date=end_date
            )
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

    def get_exceedances_by_sites(
        self, start_date, end_date, pollutant, standard, sites
    ):
        print("running the unique")
        return (
            self.date_range(
                "exceedances.time", start_date=start_date, end_date=end_date
            )
            .unwind("exceedances")
            .replace_root("exceedances")
            .project_by_standard(standard)
            .match_in(site_id=self.to_object_ids(sites))
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

    def count_standard_categories(self, df, standards_mapping, standard, pollutant):
        def find_category(value, mapping):
            for category, bounds in mapping.items():
                lower, upper = bounds
                if lower <= value <= upper:
                    return category
            return None

        device_counts = {}
        mapping = standards_mapping[standard][pollutant]

        for index, row in df.iterrows():
            device_id = row["device_id"]
            pollutant_value = row[pollutant]
            category = find_category(pollutant_value, mapping)

            if device_id not in device_counts:
                device_counts[device_id] = {}

            if category:
                if category not in device_counts[device_id]:
                    device_counts[device_id][category] = 0
                device_counts[device_id][category] += 1

        return device_counts
