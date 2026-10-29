import unittest
import uuid
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.models.vendor import Vendor
from app.models.device_schema import DeviceProfile, ComponentDefinition, MetricDefinition, ComponentRelationship
from app.models.firmware import Firmware, FirmwareType
from app.schemas.vendor import VendorCreate, VendorUpdate, VendorResponse, VendorListResponse
from app.schemas.device_schema import DeviceProfileCreate, DeviceProfileResponse
from app.schemas.firmware import FirmwareCreate, FirmwareUpdate, FirmwareRead
from app.crud.crud_vendor import vendor as vendor_crud
from app.crud.crud_diagnostics import crud_diagnostics
from app.crud.crud_firmware import crud_firmware
from app.services.diagnostics.seeds import seed_default_templates


from sqlalchemy.pool import StaticPool
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB

@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


class TestVendorAndProfileFirmwareIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create an in-memory SQLite database for testing models and CRUD
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(cls.engine)
        cls.Session = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.Session()

    def tearDown(self):
        from main import app
        app.dependency_overrides.clear()
        self.db.rollback()
        self.db.close()
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)

    def test_vendor_crud_operations(self):
        # 1. Create vendor
        v_create = VendorCreate(
            name="AirQo Test",
            description="Maker of AirQo low-cost air quality monitors",
        )
        created_vendor = vendor_crud.create(self.db, obj_in=v_create)
        self.assertIsNotNone(created_vendor.id)
        self.assertEqual(created_vendor.name, "AirQo Test")
        self.assertEqual(created_vendor.description, "Maker of AirQo low-cost air quality monitors")

        # 2. Get by name
        fetched_by_name = vendor_crud.get_by_name(self.db, name="airqo test")
        self.assertIsNotNone(fetched_by_name)
        self.assertEqual(fetched_by_name.id, created_vendor.id)

        # 3. Get multi paginated
        items, total = vendor_crud.get_multi_paginated(self.db, skip=0, limit=10, name_filter="AirQo")
        self.assertGreaterEqual(total, 1)
        self.assertTrue(any(v.name == "AirQo Test" for v in items))

        # 4. Update vendor
        v_update = VendorUpdate(description="Updated description")
        updated = vendor_crud.update(self.db, db_obj=created_vendor, obj_in=v_update)
        self.assertEqual(updated.description, "Updated description")

        # 5. Delete vendor
        v_id = created_vendor.id
        removed = vendor_crud.remove(self.db, id=v_id)
        self.assertEqual(removed.id, v_id)
        self.assertIsNone(vendor_crud.get(self.db, id=v_id))

    def test_device_profile_vendor_relationship_and_no_firmware_compatibility(self):
        # Create a vendor
        vendor_obj = Vendor(
            id=uuid.uuid4(),
            name="Met One Instruments Test",
            description="Reference monitors",
        )
        self.db.add(vendor_obj)
        self.db.flush()

        # Create a profile linked to vendor
        profile = DeviceProfile(
            id=uuid.uuid4(),
            name="bam_test_profile",
            category="reference_monitor",
            description="BAM Reference Station Profile",
            vendor_id=vendor_obj.id,
        )
        self.db.add(profile)
        self.db.flush()

        # Check relationship
        self.assertEqual(profile.vendor_id, vendor_obj.id)
        self.assertEqual(profile.vendor.name, "Met One Instruments Test")
        self.assertIn(profile, vendor_obj.device_profiles)

        # Verify firmware_compatibility is not an attribute
        self.assertFalse(hasattr(profile, "firmware_compatibility"))

        # Verify Pydantic response schema
        resp = DeviceProfileResponse.model_validate(profile)
        self.assertEqual(resp.name, "bam_test_profile")
        self.assertEqual(resp.vendor_id, vendor_obj.id)
        self.assertIsNotNone(resp.vendor)
        self.assertEqual(resp.vendor.name, "Met One Instruments Test")
        self.assertFalse(hasattr(resp, "firmware_compatibility"))

    def test_firmware_vendor_relationship(self):
        # Create a vendor
        vendor_obj = Vendor(
            id=uuid.uuid4(),
            name="AirQo Firmware Vendor",
            description="Firmware provider",
        )
        self.db.add(vendor_obj)
        self.db.flush()

        # Create firmware linked to vendor
        fw = Firmware(
            id=uuid.uuid4(),
            firmware_version="3.0.0-test",
            firmware_string="firmware/3.0.0-test.bin",
            firmware_type=FirmwareType.stable,
            vendor_id=vendor_obj.id,
            description="Release version 3.0.0",
        )
        self.db.add(fw)
        self.db.flush()

        self.assertEqual(fw.vendor_id, vendor_obj.id)
        self.assertEqual(fw.vendor.name, "AirQo Firmware Vendor")
        self.assertIn(fw, vendor_obj.firmwares)

        # Verify Pydantic response schema
        fw_read = FirmwareRead.model_validate(fw)
        self.assertEqual(fw_read.firmware_version, "3.0.0-test")
        self.assertEqual(fw_read.vendor_id, vendor_obj.id)
        self.assertIsNotNone(fw_read.vendor)
        self.assertEqual(fw_read.vendor.name, "AirQo Firmware Vendor")

    def test_seed_default_templates_creates_vendors_and_links_profiles(self):
        res = seed_default_templates(self.db)
        self.assertEqual(res["status"], "success")

        # Verify seeded vendors
        airqo = self.db.query(Vendor).filter(Vendor.name == "AirQo").first()
        met_one = self.db.query(Vendor).filter(Vendor.name == "Met One Instruments").first()
        coldchain = self.db.query(Vendor).filter(Vendor.name == "Generic ColdChain").first()

        self.assertIsNotNone(airqo)
        self.assertIsNotNone(met_one)
        self.assertIsNotNone(coldchain)

        # Verify profile links
        lowcost = self.db.query(DeviceProfile).filter(DeviceProfile.name == "lowcost").first()
        gas = self.db.query(DeviceProfile).filter(DeviceProfile.name == "lowcost_gas").first()
        bam = self.db.query(DeviceProfile).filter(DeviceProfile.name == "bam").first()
        cc = self.db.query(DeviceProfile).filter(DeviceProfile.name == "ColdChain-UltraLow-Monitor").first()

        self.assertIsNotNone(lowcost)
        self.assertEqual(lowcost.vendor_id, airqo.id)
        self.assertEqual(lowcost.vendor.name, "AirQo")

        self.assertIsNotNone(gas)
        self.assertEqual(gas.vendor_id, airqo.id)

        self.assertIsNotNone(bam)
        self.assertEqual(bam.vendor_id, met_one.id)

        self.assertIsNotNone(cc)
        self.assertEqual(cc.vendor_id, coldchain.id)

    def test_vendor_and_profile_api_endpoints(self):
        from fastapi.testclient import TestClient
        from main import app
        from app.db.session import get_db

        def override_get_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)

        # 1. POST /api/v1/vendors/
        v_res = client.post(
            "/api/v1/vendors/",
            json={"name": "Sensirion AG", "description": "Swiss sensor manufacturer"}
        )
        self.assertEqual(v_res.status_code, 201)
        v_data = v_res.json()
        self.assertEqual(v_data["name"], "Sensirion AG")
        vendor_id = v_data["id"]

        # Duplicate name returns 400
        v_dup = client.post(
            "/api/v1/vendors/",
            json={"name": "Sensirion AG"}
        )
        self.assertEqual(v_dup.status_code, 400)

        # 2. GET /api/v1/vendors/
        list_res = client.get("/api/v1/vendors/?name=Sensirion")
        self.assertEqual(list_res.status_code, 200)
        list_data = list_res.json()
        self.assertGreaterEqual(list_data["total"], 1)
        self.assertTrue(any(v["id"] == vendor_id for v in list_data["vendors"]))

        # 3. GET /api/v1/vendors/{id}
        get_res = client.get(f"/api/v1/vendors/{vendor_id}")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()["id"], vendor_id)

        # 4. PATCH /api/v1/vendors/{id}
        patch_res = client.patch(
            f"/api/v1/vendors/{vendor_id}",
            json={"description": "Updated sensor manufacturer description"}
        )
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.json()["description"], "Updated sensor manufacturer description")

        # 5. POST /api/v1/diagnostics/profiles with vendor_id
        profile_res = client.post(
            "/api/v1/diagnostics/profiles",
            json={
                "name": "Sensirion-SPS30-Station",
                "category": "air_quality",
                "description": "Sensirion optical particle sensor station",
                "vendor_id": vendor_id,
                "telemetry_mappings": {"field1": {"key": "pm2_5", "label": "PM2.5"}},
                "config_mappings": {},
                "metadata_mappings": {},
            }
        )
        self.assertEqual(profile_res.status_code, 201)
        p_data = profile_res.json()
        self.assertEqual(p_data["name"], "Sensirion-SPS30-Station")
        self.assertEqual(p_data["vendor_id"], vendor_id)
        self.assertIsNotNone(p_data.get("vendor"))
        self.assertEqual(p_data["vendor"]["name"], "Sensirion AG")
        self.assertNotIn("firmware_compatibility", p_data)

        # 6. GET /api/v1/diagnostics/profiles filtered by vendor_id
        prof_list = client.get(f"/api/v1/diagnostics/profiles?vendor_id={vendor_id}")
        self.assertEqual(prof_list.status_code, 200)
        self.assertTrue(any(p["name"] == "Sensirion-SPS30-Station" for p in prof_list.json()))

        # 7. DELETE /api/v1/vendors/{id}
        del_res = client.delete(f"/api/v1/vendors/{vendor_id}")
        self.assertEqual(del_res.status_code, 200)

        # Confirm deleted
        get_del = client.get(f"/api/v1/vendors/{vendor_id}")
        self.assertEqual(get_del.status_code, 404)

        app.dependency_overrides.clear()
