"""
MongoDB repository for precomputed site exceedances.

Port of the Flask-era ExceedanceModel aggregation (api/models/exceedance.py)
onto the framework-free FastAPIPyMongoModel — same pipeline, same output
shape, minus the flask-caching memoization (results were cached for two
hours on the Flask side; BigQuery-style caching does not apply here and the
aggregation is cheap relative to the collection size).

The `exceedances` collection is written by an external process; documents
are shaped {exceedances: [{time, site_id, aqi: {...}, who: {...}}, ...]}.
Dates are matched as $gte start / $lt end (end exclusive) on strings parsed
with "%Y-%m-%dT%H:%M:%S.%fZ" — callers must pass that exact format.

pymongo is synchronous: call these methods via asyncio.to_thread.
"""

from __future__ import annotations

from api.models.base.mongo_base import FastAPIPyMongoModel


class ExceedanceRepository(FastAPIPyMongoModel):
    def __init__(self, network: str):
        super().__init__(network, collection_name="exceedances")

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

    def get_exceedances(self, start_date, end_date, pollutant, standard, sites=None):
        """
        Average exceedance counts per site over the window.

        Returns a list of {total, exceedance, site: {name, description,
        generated_name}} — `exceedance` is a dict of six category averages
        for standard="aqi" and a scalar for standard="who".

        NOTE: a falsy `sites` value ([] or None) means "no site filter" —
        the aggregation then covers every site in the network database.
        Callers must guard if that is not intended (the API schema enforces
        a non-empty list).

        Raises bson.errors.InvalidId if any site id is not a valid ObjectId.
        """
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
