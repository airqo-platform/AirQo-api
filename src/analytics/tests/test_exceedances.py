"""
Tests for the exceedance helpers and the MongoDB exceedance repository.

count_standard_categories is pure pandas (lifted from the Flask
ExceedanceModel); the repository tests patch MongoClient and assert on the
aggregation pipeline stages, so no live Mongo is needed.
"""

from __future__ import annotations

from unittest.mock import patch

import pandas as pd
import pytest

from api.models.exceedances_repo import ExceedanceRepository
from api.utils.pollutants.exceedances import (
    STANDARDS_MAPPING,
    count_standard_categories,
)


def _df(rows):
    return pd.DataFrame(rows, columns=["device_id", "pm2_5"])


class TestCountStandardCategories:
    def test_counts_by_band(self):
        df = _df([("d1", 5.0), ("d1", 20.0), ("d1", 40.0), ("d2", 5.0)])
        counts = count_standard_categories(df, "aqi", "pm2_5")
        assert counts == {
            "d1": {"Good": 1, "Moderate": 1, "UHFSG": 1},
            "d2": {"Good": 1},
        }

    def test_bounds_are_inclusive(self):
        """value == upper bound counts for that band (aqi pm2_5 Good = [0, 12])."""
        df = _df([("d1", 12.0), ("d1", 0.0)])
        counts = count_standard_categories(df, "aqi", "pm2_5")
        assert counts == {"d1": {"Good": 2}}

    def test_gap_values_are_uncategorised(self):
        """The aqi bands have gaps (e.g. 12.05 falls between Good and Moderate) —
        such rows are counted nowhere, but the device still gets an entry."""
        df = _df([("d1", 12.05)])
        counts = count_standard_categories(df, "aqi", "pm2_5")
        assert counts == {"d1": {}}

    def test_out_of_band_device_present_with_empty_counts(self):
        df = _df([("d1", 9999.0), ("d2", 5.0)])
        counts = count_standard_categories(df, "aqi", "pm2_5")
        assert counts["d1"] == {}
        assert counts["d2"] == {"Good": 1}

    def test_who_standard_uses_who_bands(self):
        # 11 is Moderate under who pm2_5 but Good under aqi pm2_5
        df = _df([("d1", 11.0)])
        assert count_standard_categories(df, "who", "pm2_5") == {"d1": {"Moderate": 1}}
        assert count_standard_categories(df, "aqi", "pm2_5") == {"d1": {"Good": 1}}

    def test_empty_frame(self):
        assert count_standard_categories(_df([]), "aqi", "pm2_5") == {}

    def test_mapping_covers_expected_standards_and_pollutants(self):
        assert set(STANDARDS_MAPPING) == {"aqi", "who"}
        for standard in STANDARDS_MAPPING.values():
            assert set(standard) == {"pm2_5", "pm10"}
            for bands in standard.values():
                assert list(bands) == [
                    "Good",
                    "Moderate",
                    "UHFSG",
                    "Unhealthy",
                    "VeryUnhealthy",
                    "Hazardous",
                ]


class TestExceedanceRepository:
    def _repo(self):
        with patch("api.models.base.mongo_base.MongoClient"):
            repo = ExceedanceRepository("airqo")
        repo.collection.aggregate.return_value = iter([])
        return repo

    def test_pipeline_stages_without_sites(self):
        repo = self._repo()
        repo.get_exceedances(
            "2024-01-01T00:00:00.000000Z",
            "2024-02-01T00:00:00.000000Z",
            "pm2_5",
            "aqi",
        )

        stages = repo.collection.aggregate.call_args.args[0]
        # $match on exceedances.time with $gte/$lt datetimes (end exclusive)
        match = stages[0]["$match"]["$and"][0]["exceedances.time"]
        assert match["$gte"].year == 2024 and match["$gte"].month == 1
        assert "$lt" in match

        rest = stages[1:]
        assert rest[0] == {"$unwind": "$exceedances"}
        assert rest[1] == {"$replaceRoot": {"newRoot": "$exceedances"}}
        assert rest[2]["$project"] == {"site_id": {"$toObjectId": "$site_id"}, "aqi": 1}
        assert rest[3]["$lookup"]["from"] == "sites"
        group = rest[4]["$group"]
        assert group["_id"] == "$site_id"
        assert group["Good"] == {"$avg": "$aqi.pm2_5.Good"}
        assert group["totalRaw"] == {"$avg": "$aqi.total"}
        assert rest[5]["$addFields"]["total"] == {"$round": "$totalRaw"}
        assert rest[6] == {"$unwind": "$site"}
        assert rest[7]["$project"] == {
            "_id": 0,
            "total": 1,
            "exceedance": 1,
            "site": {"name": 1, "description": 1, "generated_name": 1},
        }

    def test_pipeline_with_sites_adds_objectid_match(self):
        from bson.objectid import ObjectId

        repo = self._repo()
        site_id = "5f8f8c44b54764421b7156da"
        repo.get_exceedances(
            "2024-01-01T00:00:00.000000Z",
            "2024-02-01T00:00:00.000000Z",
            "pm2_5",
            "aqi",
            sites=[site_id],
        )

        stages = repo.collection.aggregate.call_args.args[0]
        in_matches = [
            s["$match"]["site_id"]["$in"]
            for s in stages
            if "$match" in s and "site_id" in s.get("$match", {})
        ]
        assert in_matches == [(ObjectId(site_id),)]

    def test_invalid_site_id_raises_invalid_id(self):
        from bson.errors import InvalidId

        repo = self._repo()
        with pytest.raises(InvalidId):
            repo.get_exceedances(
                "2024-01-01T00:00:00.000000Z",
                "2024-02-01T00:00:00.000000Z",
                "pm2_5",
                "aqi",
                sites=["not-an-objectid"],
            )

    def test_who_standard_groups_scalar(self):
        repo = self._repo()
        repo.get_exceedances(
            "2024-01-01T00:00:00.000000Z",
            "2024-02-01T00:00:00.000000Z",
            "pm2_5",
            "who",
        )
        stages = repo.collection.aggregate.call_args.args[0]
        group = next(s["$group"] for s in stages if "$group" in s)
        assert group["pm2_5"] == {"$avg": "$who.pm2_5"}
        assert group["totalRaw"] == {"$avg": "$who.total"}
        project = next(
            s["$project"] for s in stages if "$project" in s and "who" in s["$project"]
        )
        assert project == {"site_id": {"$toObjectId": "$site_id"}, "who": 1}
