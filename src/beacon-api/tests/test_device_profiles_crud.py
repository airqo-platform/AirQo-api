import unittest
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB
from fastapi.testclient import TestClient

from app.db.session import Base, get_db
from app.models.vendor import Vendor
from app.models.device_schema import DeviceProfile, ComponentDefinition, MetricDefinition, ComponentRelationship
from app.models.diagnostics import DiagnosticTemplate, ProfileDiagnosticTemplate
from app.schemas.diagnostics import DeviceProfileUpdateSchema as SchemaFromDiag
from app.schemas.device_schema import (
    DeviceProfileCreate,
    DeviceProfileResponse,
    DeviceProfileUpdateSchema as SchemaFromDevice,
)
from app.crud.crud_diagnostics import crud_diagnostics
from main import app

@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


class TestDeviceProfilesCRUD(unittest.TestCase):
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
        self.db.rollback()
        self.db.close()

    def test_schema_importable_from_both_modules(self):
        self.assertIs(SchemaFromDiag, SchemaFromDevice)
        schema_inst = SchemaFromDiag(
            name="Test-Profile",
            description="Testing schema instantiation",
            telemetry_mappings={"f1": {"key": "temp"}},
        )
        self.assertEqual(schema_inst.name, "Test-Profile")

    def test_put_device_profile_full_update(self):
        # 1. Create a vendor
        vendor = Vendor(
            id=uuid.uuid4(),
            name="Test Vendor A",
            description="First Vendor",
        )
        vendor_b = Vendor(
            id=uuid.uuid4(),
            name="Test Vendor B",
            description="Second Vendor",
        )
        self.db.add_all([vendor, vendor_b])
        self.db.commit()

        # 2. Create an initial profile via POST
        create_payload = {
            "name": "AirQo-v5-Test",
            "category": "air_quality",
            "description": "Initial test profile",
            "vendor_id": str(vendor.id),
            "telemetry_mappings": {
                "field1": {"key": "pm2_5", "label": "PM 2.5", "unit": "ug/m3"}
            },
            "config_mappings": {
                "config1": {"key": "interval", "type": "int", "default": 60}
            },
            "metadata_mappings": {
                "meta1": {"key": "hw_rev", "label": "Hardware Revision"}
            },
            "components": [
                {
                    "name": "power_subsystem",
                    "component_type": "battery",
                    "criticality": 0.8,
                    "metrics": [
                        {
                            "key": "battery_voltage",
                            "unit": "V",
                            "expected_min": 3.0,
                            "expected_max": 4.2,
                        }
                    ],
                }
            ],
        }
        res_create = self.client.post("/api/v1/diagnostics/profiles", json=create_payload)
        self.assertEqual(res_create.status_code, 201)
        profile_data = res_create.json()
        profile_id = profile_data["id"]
        self.assertEqual(len(profile_data["components"]), 1)
        battery_comp_id = profile_data["components"][0]["id"]

        # 3. Update via PUT: modify metadata, change vendor to vendor_b, edit existing component, add solar component, add relationship
        put_payload = {
            "name": "AirQo-v5-Updated",
            "category": "air_quality_upgraded",
            "description": "Updated profile description",
            "vendor_id": str(vendor_b.id),
            "meta_data": {"firmware_family": "v5-esp32"},
            "telemetry_mappings": {
                "field1": {"key": "pm2_5", "label": "PM 2.5", "unit": "ug/m3"},
                "field2": {"key": "pm10", "label": "PM 10", "unit": "ug/m3"},
            },
            "config_mappings": {
                "config1": {"key": "interval", "type": "int", "default": 30}
            },
            "metadata_mappings": {
                "meta1": {"key": "hw_rev", "label": "Hardware Revision v2"}
            },
            "components": [
                {
                    "id": battery_comp_id,
                    "name": "power_subsystem",
                    "component_type": "battery",
                    "criticality": 0.9,
                    "metrics": [
                        {
                            "key": "battery_voltage",
                            "unit": "V",
                            "expected_min": 3.2,
                            "expected_max": 4.2,
                        },
                        {
                            "key": "battery_current",
                            "unit": "mA",
                        },
                    ],
                },
                {
                    "name": "solar_panel",
                    "component_type": "solar",
                    "criticality": 0.6,
                    "metrics": [
                        {
                            "key": "solar_voltage",
                            "unit": "V",
                        }
                    ],
                },
            ],
            "relationships": [
                {
                    "source": "solar_panel",
                    "target": "power_subsystem",
                    "relationship_type": "POWERS",
                }
            ],
        }
        res_put = self.client.put(f"/api/v1/diagnostics/profiles/{profile_id}", json=put_payload)
        self.assertEqual(res_put.status_code, 200)
        updated = res_put.json()

        # Check metadata updates
        self.assertEqual(updated["name"], "AirQo-v5-Updated")
        self.assertEqual(updated["category"], "air_quality_upgraded")
        self.assertEqual(updated["description"], "Updated profile description")
        self.assertEqual(updated["vendor_id"], str(vendor_b.id))
        self.assertEqual(updated["meta_data"], {"firmware_family": "v5-esp32"})

        # Check mappings
        self.assertIn("field2", updated["telemetry_mappings"])
        self.assertEqual(updated["config_mappings"]["config1"]["default"], 30)

        # Check components
        self.assertEqual(len(updated["components"]), 2)
        comp_names = {c["name"] for c in updated["components"]}
        self.assertEqual(comp_names, {"power_subsystem", "solar_panel"})

        # Check metrics under power_subsystem
        power_c = next(c for c in updated["components"] if c["name"] == "power_subsystem")
        self.assertEqual(power_c["id"], battery_comp_id)
        self.assertEqual(len(power_c["metrics"]), 2)

        # Check relationship
        self.assertEqual(len(updated["relationships"]), 1)
        rel = updated["relationships"][0]
        self.assertEqual(rel["relationship_type"], "POWERS")

    def test_patch_device_profile_partial_update(self):
        # Create a profile
        p = DeviceProfile(
            id=uuid.uuid4(),
            name="Profile-For-Patch",
            category="generic",
            description="Original description",
            telemetry_mappings={"f1": {"key": "val1"}},
        )
        c = ComponentDefinition(
            id=uuid.uuid4(),
            profile_id=p.id,
            name="subsys1",
            component_type="sensor",
            criticality=1.0,
        )
        self.db.add(p)
        self.db.add(c)
        self.db.commit()

        # PATCH description only
        res_patch = self.client.patch(
            f"/api/v1/diagnostics/profiles/{p.id}",
            json={"description": "Patched description"}
        )
        self.assertEqual(res_patch.status_code, 200)
        data = res_patch.json()
        self.assertEqual(data["description"], "Patched description")
        self.assertEqual(data["name"], "Profile-For-Patch")
        # Ensure component was not deleted
        self.assertEqual(len(data["components"]), 1)
        self.assertEqual(data["components"][0]["name"], "subsys1")

    def test_put_duplicate_name_error(self):
        p1 = DeviceProfile(
            id=uuid.uuid4(),
            name="Profile-Alpha",
            category="test",
        )
        p2 = DeviceProfile(
            id=uuid.uuid4(),
            name="Profile-Beta",
            category="test",
        )
        self.db.add_all([p1, p2])
        self.db.commit()

        # Attempt to rename Profile-Beta to Profile-Alpha
        res = self.client.put(
            f"/api/v1/diagnostics/profiles/{p2.id}",
            json={"name": "Profile-Alpha"}
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("already exists", res.json()["detail"])

    def test_update_and_delete_404_not_found(self):
        random_id = str(uuid.uuid4())
        put_res = self.client.put(
            f"/api/v1/diagnostics/profiles/{random_id}",
            json={"name": "Ghost"}
        )
        self.assertEqual(put_res.status_code, 404)
        self.assertIn("not found", put_res.json()["detail"])

        del_res = self.client.delete(f"/api/v1/diagnostics/profiles/{random_id}")
        self.assertEqual(del_res.status_code, 404)
        self.assertIn("not found", del_res.json()["detail"])

    def test_delete_device_profile_success(self):
        p = DeviceProfile(
            id=uuid.uuid4(),
            name="Profile-To-Delete",
            category="air_quality",
            description="Soon to be deleted",
        )
        self.db.add(p)
        self.db.commit()

        # DELETE profile
        del_res = self.client.delete(f"/api/v1/diagnostics/profiles/{p.id}")
        self.assertEqual(del_res.status_code, 200)
        self.assertEqual(del_res.json(), {
            "success": True,
            "message": f"Profile '{p.id}' deleted successfully"
        })

        # Subsequent GET should return 404
        get_res = self.client.get(f"/api/v1/diagnostics/profiles/{p.id}")
        self.assertEqual(get_res.status_code, 404)

    def test_component_coordinates_crud_and_fallback(self):
        # 1. Create a profile with components having x_coordinate and y_coordinate
        create_payload = {
            "name": "Profile-Coordinates-Test",
            "category": "air_quality",
            "components": [
                {
                    "name": "solar_panel",
                    "component_type": "solar",
                    "criticality": 0.3,
                    "x_coordinate": 120.5,
                    "y_coordinate": 250.0,
                    "meta_data": {"tile": "top_left"},
                },
                {
                    "name": "battery",
                    "component_type": "battery",
                    "criticality": 0.4,
                    # Backward compatibility fallback test: coordinates in meta_data
                    "meta_data": {"x_coordinate": 350.0, "y_coordinate": 400.5},
                }
            ]
        }
        res = self.client.post("/api/v1/diagnostics/profiles", json=create_payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        profile_id = data["id"]
        comps = data["components"]
        self.assertEqual(len(comps), 2)

        solar = next(c for c in comps if c["name"] == "solar_panel")
        self.assertEqual(solar["x_coordinate"], 120.5)
        self.assertEqual(solar["y_coordinate"], 250.0)

        battery = next(c for c in comps if c["name"] == "battery")
        self.assertEqual(battery["x_coordinate"], 350.0)
        self.assertEqual(battery["y_coordinate"], 400.5)

        # 2. Test GET /profiles/{id}/components
        list_res = self.client.get(f"/api/v1/diagnostics/profiles/{profile_id}/components")
        self.assertEqual(list_res.status_code, 200)
        self.assertEqual(len(list_res.json()), 2)

        # 3. Test POST /profiles/{id}/components (Create a new component)
        new_comp_payload = {
            "name": "pm_sensor",
            "component_type": "sensor",
            "criticality": 0.5,
            "x_coordinate": 500.0,
            "y_coordinate": 100.0,
            "metrics": [
                {"key": "pm2_5", "unit": "ug/m3", "expected_min": 0.0, "expected_max": 500.0}
            ]
        }
        post_comp_res = self.client.post(
            f"/api/v1/diagnostics/profiles/{profile_id}/components",
            json=new_comp_payload
        )
        self.assertEqual(post_comp_res.status_code, 201)
        created_comp = post_comp_res.json()
        comp_id = created_comp["id"]
        self.assertEqual(created_comp["x_coordinate"], 500.0)
        self.assertEqual(created_comp["y_coordinate"], 100.0)
        self.assertEqual(len(created_comp["metrics"]), 1)

        # 4. Test GET /profiles/{id}/components/{comp_id}
        get_comp_res = self.client.get(f"/api/v1/diagnostics/profiles/{profile_id}/components/{comp_id}")
        self.assertEqual(get_comp_res.status_code, 200)
        self.assertEqual(get_comp_res.json()["name"], "pm_sensor")

        # 5. Test PUT /profiles/{id}/components/{comp_id} (Update coordinates)
        update_comp_res = self.client.put(
            f"/api/v1/diagnostics/profiles/{profile_id}/components/{comp_id}",
            json={"x_coordinate": 650.0, "y_coordinate": 320.5}
        )
        self.assertEqual(update_comp_res.status_code, 200)
        updated_comp = update_comp_res.json()
        self.assertEqual(updated_comp["x_coordinate"], 650.0)
        self.assertEqual(updated_comp["y_coordinate"], 320.5)

        # 6. Test PUT /profiles/{id} updating whole profile with component coordinates
        put_prof_res = self.client.put(
            f"/api/v1/diagnostics/profiles/{profile_id}",
            json={
                "components": [
                    {
                        "id": solar["id"],
                        "name": "solar_panel",
                        "component_type": "solar",
                        "x_coordinate": 180.0,
                        "y_coordinate": 290.0,
                    }
                ]
            }
        )
        self.assertEqual(put_prof_res.status_code, 200)
        updated_comps = put_prof_res.json()["components"]
        updated_solar = next(c for c in updated_comps if c["name"] == "solar_panel")
        self.assertEqual(updated_solar["x_coordinate"], 180.0)
        self.assertEqual(updated_solar["y_coordinate"], 290.0)

        # 7. Test DELETE /profiles/{id}/components/{comp_id}
        del_comp_res = self.client.delete(f"/api/v1/diagnostics/profiles/{profile_id}/components/{solar['id']}")
        self.assertEqual(del_comp_res.status_code, 200)
        self.assertTrue(del_comp_res.json()["success"])

    def test_update_profile_vendor_fallback_lookups(self):
        # 1. Create two test vendors
        vendor_1 = Vendor(id=uuid.uuid4(), name="Vendor Alpha", description="Alpha vendor")
        vendor_2 = Vendor(id=uuid.uuid4(), name="Vendor Beta", description="Beta vendor")
        self.db.add_all([vendor_1, vendor_2])
        self.db.commit()

        # 2. Create a test profile
        profile = DeviceProfile(
            id=uuid.uuid4(),
            name="vendor-fallback-test-profile",
            category="air_quality",
            vendor_id=None,
        )
        self.db.add(profile)
        self.db.commit()

        # 3. Test fallback via vendor_id string (non-UUID string matching Vendor.name)
        update_schema_1 = SchemaFromDiag(vendor_id="Vendor Alpha")
        updated_prof_1 = crud_diagnostics.update_profile(self.db, db_obj=profile, obj_in=update_schema_1)
        self.assertEqual(updated_prof_1.vendor_id, vendor_1.id)

        # 4. Test fallback via vendor string (vendor_id is None, vendor="Vendor Beta")
        update_schema_2 = SchemaFromDiag(vendor="Vendor Beta")
        updated_prof_2 = crud_diagnostics.update_profile(self.db, db_obj=profile, obj_in=update_schema_2)
        self.assertEqual(updated_prof_2.vendor_id, vendor_2.id)


