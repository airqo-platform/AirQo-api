"""
Tests for the framework-free MongoDB base model (FastAPIPyMongoModel).

No live Mongo needed — MongoClient is patched.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from api.models.base.mongo_base import FastAPIPyMongoModel


class TestFastAPIPyMongoModel:
    def test_database_name_composition(self):
        with patch("api.models.base.mongo_base.MongoClient") as mock_client_cls:
            model = FastAPIPyMongoModel("airqo", "exceedances")

        mock_client_cls.assert_called_once_with("mongodb://test-host:27017")
        client = mock_client_cls.return_value
        client.__getitem__.assert_called_once_with("test_db_airqo")
        assert model.collection_name == "exceedances"

    def test_network_is_lowercased_and_defaulted(self):
        with patch("api.models.base.mongo_base.MongoClient") as mock_client_cls:
            model = FastAPIPyMongoModel("AIRQO", "x")
            assert model.network == "airqo"

            model_default = FastAPIPyMongoModel("", "x")
            assert model_default.network == "airqo"

    def test_inherits_pipeline_operations(self):
        with patch("api.models.base.mongo_base.MongoClient"):
            model = FastAPIPyMongoModel("airqo", "x")

        # Chainable pipeline vocabulary from ModelOperations must be available
        assert callable(model.date_range)
        assert callable(model.unwind)
        assert callable(model.lookup)
        assert callable(model.exec)

    def test_insert_uses_pymongo4_insert_one(self):
        """Collection.insert was removed in PyMongo 4 — the base must use
        insert_one so writes work under the pinned pymongo~=4.5."""
        with patch("api.models.base.mongo_base.MongoClient"):
            model = FastAPIPyMongoModel("airqo", "x")

        model.collection = MagicMock(spec=["insert_one"])
        model.insert({"a": 1})
        model.collection.insert_one.assert_called_once_with({"a": 1})

    def test_models_share_one_client_per_uri(self):
        """Models are built per request — the underlying MongoClient
        (connection pool) must be shared, not recreated each time."""
        with patch("api.models.base.mongo_base.MongoClient") as mock_client_cls:
            FastAPIPyMongoModel("airqo", "exceedances")
            FastAPIPyMongoModel("airqo", "report_template")

        mock_client_cls.assert_called_once()

    def test_exec_resets_chain_state(self):
        """exec() must clear the accumulated pipeline so a reused instance
        builds a second, independent query (its docstring always claimed
        this; previously both pipelines were silently ANDed together)."""
        with patch("api.models.base.mongo_base.MongoClient"):
            model = FastAPIPyMongoModel("airqo", "x")
        model.collection = MagicMock()
        model.collection.aggregate.return_value = iter([])

        model.filter_by(user_id="u1").unwind("items").exec()
        model.filter_by(user_id="u2").exec()

        second_stages = model.collection.aggregate.call_args.args[0]
        assert {"$unwind": "$items"} not in second_stages
        match = second_stages[0]["$match"]["$and"]
        assert match == [{"user_id": "u2"}]
