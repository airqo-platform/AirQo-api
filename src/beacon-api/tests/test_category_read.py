import json
import uuid
import unittest
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB
from fastapi.testclient import TestClient

from app.db.session import Base, get_db
from app.models.device_schema import DeviceProfile
from app.crud.crud_category import profile_to_category_read, category as category_crud
from app.utils.field_mappings import ensure_dict, extract_label, map_record_from_profile
from main import app


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


class TestCategoryReadAndEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.Session()

        def override_get_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.query(DeviceProfile).delete()
        self.db.commit()
        self.db.close()

    def test_ensure_dict_various_inputs(self):
        self.assertEqual(ensure_dict(None), {})
        self.assertEqual(ensure_dict({}), {})
        self.assertEqual(ensure_dict({"a": 1}), {"a": 1})
        self.assertEqual(ensure_dict("{}"), {})
        self.assertEqual(ensure_dict('{"field1": {"label": "PM2.5"}}'), {"field1": {"label": "PM2.5"}})
        # Double encoded JSON string
        double_encoded = json.dumps(json.dumps({"field1": {"label": "PM2.5"}}))
        self.assertEqual(ensure_dict(double_encoded), {"field1": {"label": "PM2.5"}})
        # Invalid / non-dict string
        self.assertEqual(ensure_dict("not json"), {})
        self.assertEqual(ensure_dict(""), {})
        self.assertEqual(ensure_dict("   "), {})
        self.assertEqual(ensure_dict(123), {})
        self.assertEqual(ensure_dict(["list"]), {})

    def test_extract_label(self):
        self.assertIsNone(extract_label(None))
        self.assertIsNone(extract_label({}))
        self.assertEqual(extract_label({"label": "Sensor 1 PM2.5"}), "Sensor 1 PM2.5")
        self.assertEqual(extract_label({"key": "pm2_5"}), "pm2_5")
        self.assertEqual(extract_label({"label": "Sensor 1 PM2.5", "key": "pm2_5"}), "Sensor 1 PM2.5")
        self.assertEqual(extract_label("Raw String Label"), "Raw String Label")

    def test_profile_to_category_read_with_string_mappings(self):
        profile = DeviceProfile(
            id=uuid.uuid4(),
            name="test_str_profile",
            category="air_quality",
            description="Profile with JSON string mappings",
            telemetry_mappings=json.dumps({"field1": {"label": "Sensor 1 PM2.5"}, "field7": {"label": "Battery"}}),
            config_mappings=json.dumps({"config1": {"label": "Sample Rate"}}),
            metadata_mappings=json.dumps({"metadata1": {"label": "Hardware Rev"}}),
        )
        cat_read = profile_to_category_read(profile)
        self.assertEqual(cat_read.name, "test_str_profile")
        self.assertEqual(cat_read.level, "air_quality")
        self.assertEqual(cat_read.description, "Profile with JSON string mappings")
        self.assertEqual(cat_read.field1, "Sensor 1 PM2.5")
        self.assertEqual(cat_read.field7, "Battery")
        self.assertEqual(cat_read.config1, "Sample Rate")
        self.assertEqual(cat_read.metadata1, "Hardware Rev")

    def test_profile_to_category_read_with_empty_and_corrupt_strings(self):
        profile = DeviceProfile(
            id=uuid.uuid4(),
            name="test_corrupt_profile",
            category="air_quality",
            description="Profile with empty/invalid strings",
            telemetry_mappings="{}",
            config_mappings="",
            metadata_mappings="not a json",
        )
        cat_read = profile_to_category_read(profile)
        self.assertEqual(cat_read.name, "test_corrupt_profile")
        self.assertIsNone(cat_read.field1)
        self.assertIsNone(cat_read.config1)
        self.assertIsNone(cat_read.metadata1)

    def test_profile_to_category_read_with_dict_mappings(self):
        profile = DeviceProfile(
            id=uuid.uuid4(),
            name="test_dict_profile",
            category="air_quality",
            description="Profile with dict mappings",
            telemetry_mappings={"field1": {"label": "Sensor 1 PM2.5"}},
            config_mappings={"config1": {"key": "interval_sec"}},
            metadata_mappings={"metadata1": "Direct String"},
        )
        cat_read = profile_to_category_read(profile)
        self.assertEqual(cat_read.field1, "Sensor 1 PM2.5")
        self.assertEqual(cat_read.config1, "interval_sec")
        self.assertEqual(cat_read.metadata1, "Direct String")

    def test_api_list_categories_with_string_mappings(self):
        # Insert profile into database where SQLite stores it as string
        p = DeviceProfile(
            id=uuid.uuid4(),
            name="lowcost_monitor",
            category="air_quality",
            description="AirQo Low-Cost Monitor",
            telemetry_mappings=json.dumps({"field1": {"label": "PM2.5"}, "field2": {"label": "PM10"}}),
            config_mappings=json.dumps({"config1": {"label": "Interval"}}),
            metadata_mappings=json.dumps({"metadata1": {"label": "Serial"}}),
        )
        self.db.add(p)
        self.db.commit()

        # Call GET /api/v1/categories/?page=1&page_size=25
        response = self.client.get("/api/v1/categories/?page=1&page_size=25")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(len(data["categories"]), 1)
        cat = data["categories"][0]
        self.assertEqual(cat["name"], "lowcost_monitor")
        self.assertEqual(cat["field1"], "PM2.5")
        self.assertEqual(cat["field2"], "PM10")
        self.assertEqual(cat["config1"], "Interval")
        self.assertEqual(cat["metadata1"], "Serial")

    def test_api_get_category_by_name(self):
        p = DeviceProfile(
            id=uuid.uuid4(),
            name="bam_1020",
            category="reference_monitor",
            description="MetOne BAM",
            telemetry_mappings=json.dumps({"field2": {"label": "ConcRT"}}),
            config_mappings="{}",
            metadata_mappings="{}",
        )
        self.db.add(p)
        self.db.commit()

        response = self.client.get("/api/v1/categories/bam_1020")
        self.assertEqual(response.status_code, 200)
        cat = response.json()
        self.assertEqual(cat["name"], "bam_1020")
        self.assertEqual(cat["field2"], "ConcRT")

    def test_map_record_by_profile_with_string_telemetry(self):
        profile = DeviceProfile(
            id=uuid.uuid4(),
            name="custom_profile",
            category="air_quality",
            telemetry_mappings=json.dumps({"field1": {"key": "pm2_5_custom", "label": "Custom PM2.5"}}),
        )
        record = {"field1": 15.2, "field99": 42}
        res_keys = map_record_from_profile(record, profile, use_keys=True, drop_unmapped=True)
        self.assertEqual(res_keys, {"pm2_5_custom": 15.2})
        res_labels = map_record_from_profile(record, profile, use_keys=False, drop_unmapped=True)
        self.assertEqual(res_labels, {"Custom PM2.5": 15.2})

    def test_crud_category_update_persists_all_fields(self):
        from app.schemas.category import CategoryUpdate

        p = DeviceProfile(
            id=uuid.uuid4(),
            name="full_update_profile",
            category="initial_category",
            description="initial description",
            telemetry_mappings={},
            config_mappings={},
            metadata_mappings={},
        )
        self.db.add(p)
        self.db.commit()

        initial_cat = category_crud.get_by_name(self.db, name="full_update_profile")
        self.assertIsNotNone(initial_cat)

        update_dict = {
            "level": "updated_category",
            "description": "updated description",
        }
        for i in range(1, 16):
            update_dict[f"field{i}"] = f"Sensor Field {i}"
            update_dict[f"metadata{i}"] = f"Meta Property {i}"
        for i in range(1, 11):
            update_dict[f"config{i}"] = f"Config Param {i}"

        update_obj = CategoryUpdate(**update_dict)
        updated_cat = category_crud.update(self.db, db_obj=initial_cat, obj_in=update_obj)

        self.assertEqual(updated_cat.level, "updated_category")
        self.assertEqual(updated_cat.description, "updated description")
        for i in range(1, 16):
            self.assertEqual(getattr(updated_cat, f"field{i}"), f"Sensor Field {i}")
            self.assertEqual(getattr(updated_cat, f"metadata{i}"), f"Meta Property {i}")
        for i in range(1, 11):
            self.assertEqual(getattr(updated_cat, f"config{i}"), f"Config Param {i}")

        # Verify persisted in database
        db_p = self.db.query(DeviceProfile).filter(DeviceProfile.name == "full_update_profile").first()
        self.assertEqual(db_p.category, "updated_category")
        self.assertEqual(db_p.description, "updated description")
        self.assertEqual(ensure_dict(db_p.telemetry_mappings)["field1"]["label"], "Sensor Field 1")
        self.assertEqual(ensure_dict(db_p.metadata_mappings)["metadata1"]["label"], "Meta Property 1")
        self.assertEqual(ensure_dict(db_p.config_mappings)["config1"]["label"], "Config Param 1")

    def test_crud_category_update_clear_description_and_fields(self):
        from app.schemas.category import CategoryUpdate

        p = DeviceProfile(
            id=uuid.uuid4(),
            name="clear_profile",
            category="air_quality",
            description="Has description",
            telemetry_mappings={"field1": {"label": "PM2.5"}, "field2": {"label": "PM10"}},
            config_mappings={"config1": {"label": "Interval"}},
            metadata_mappings={"metadata1": {"label": "Revision"}},
        )
        self.db.add(p)
        self.db.commit()

        initial_cat = category_crud.get_by_name(self.db, name="clear_profile")

        # Clear description to None, and clear field1
        update_obj = CategoryUpdate(description=None, field1=None)
        updated_cat = category_crud.update(self.db, db_obj=initial_cat, obj_in=update_obj)

        self.assertIsNone(updated_cat.description)
        self.assertIsNone(updated_cat.field1)
        self.assertEqual(updated_cat.field2, "PM10")
        self.assertEqual(updated_cat.config1, "Interval")

        # Test clearing description to empty string
        update_obj_empty = CategoryUpdate(description="")
        updated_cat_2 = category_crud.update(self.db, db_obj=updated_cat, obj_in=update_obj_empty)
        self.assertEqual(updated_cat_2.description, "")

    def test_crud_category_update_unsupported_fields_rejected(self):
        p = DeviceProfile(
            id=uuid.uuid4(),
            name="unsupported_profile",
            category="air_quality",
        )
        self.db.add(p)
        self.db.commit()

        initial_cat = category_crud.get_by_name(self.db, name="unsupported_profile")

        with self.assertRaises(ValueError) as ctx:
            category_crud.update(self.db, db_obj=initial_cat, obj_in={"invalid_col": "value", "description": "test"})
        self.assertIn("Unsupported field(s)", str(ctx.exception))
        self.assertIn("invalid_col", str(ctx.exception))

    def test_api_put_category_endpoint(self):
        p = DeviceProfile(
            id=uuid.uuid4(),
            name="api_update_profile",
            category="air_quality",
            description="Before API update",
            telemetry_mappings={"field1": {"label": "Old Field"}},
        )
        self.db.add(p)
        self.db.commit()

        payload = {
            "description": "After API update",
            "level": "cold_chain",
            "field1": "New Sensor Label",
            "config1": "New Config Label",
        }
        res = self.client.put("/api/v1/categories/api_update_profile", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["name"], "api_update_profile")
        self.assertEqual(data["description"], "After API update")
        self.assertEqual(data["level"], "cold_chain")
        self.assertEqual(data["field1"], "New Sensor Label")
        self.assertEqual(data["config1"], "New Config Label")

