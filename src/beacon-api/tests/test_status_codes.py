import unittest
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.models.device_schema import DeviceProfile
from app.models.status_codes import StatusCode, StatusCodeSet
from app.models.vendor import Vendor
from app.services.diagnostics.seeds import BAM_STATUS_CODES, BAM_TELEMETRY_MAPPINGS, seed_status_code_sets, _link_status_code_set
from app.services.status_codes import decode_value, validate_codes
from main import app


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


BAM_CODES = [SimpleNamespace(description=None, **{k: v for k, v in c.items() if k != "description"}) for c in BAM_STATUS_CODES]


def _decode(value, rule="bitmask", codes=BAM_CODES):
    result = decode_value(rule, codes, value)
    return result["status"], [c["code"] for c in result["codes"]], result["unknown_codes"]


class TestDecodeValue(unittest.TestCase):
    def test_bitmask_splits_a_sum_into_its_codes(self):
        self.assertEqual(_decode(17), ("fault", [1, 16], []))
        self.assertEqual(_decode(144), ("fault", [16, 128], []))

    def test_zero_is_ok(self):
        self.assertEqual(_decode(0), ("ok", [0], []))
        # Still ok when the set has no code 0 defined.
        self.assertEqual(_decode(0, codes=BAM_CODES[1:]), ("ok", [], []))

    def test_informational_codes(self):
        self.assertEqual(_decode(512), ("info", [512], []))
        self.assertEqual(_decode(768), ("info", [256, 512], []))

    def test_fault_outranks_informational(self):
        self.assertEqual(_decode(528), ("fault", [16, 512], []))

    def test_undefined_bits_are_reported(self):
        self.assertEqual(_decode(1040), ("fault", [16], [1024]))
        self.assertEqual(_decode(1536), ("unknown", [512], [1024]))
        self.assertEqual(_decode(1024), ("unknown", [], [1024]))

    def test_accepts_whole_number_floats_and_strings(self):
        self.assertEqual(_decode(17.0), ("fault", [1, 16], []))
        self.assertEqual(_decode("17"), ("fault", [1, 16], []))

    def test_invalid_values(self):
        for value in (None, "abc", 3.5, -1, float("nan"), float("inf"), True):
            self.assertEqual(_decode(value)[0], "invalid", value)

    def test_exact_rule_matches_one_code(self):
        codes = [
            SimpleNamespace(code=0, label="OK", description=None, kind="ok"),
            SimpleNamespace(code=3, label="Calibrating", description=None, kind="info"),
            SimpleNamespace(code=5, label="Pump fault", description=None, kind="fault"),
        ]
        self.assertEqual(_decode(3, "exact", codes), ("info", [3], []))
        self.assertEqual(_decode(5, "exact", codes), ("fault", [5], []))
        self.assertEqual(_decode(0, "exact", codes), ("ok", [0], []))
        # 8 is not a defined code, and exact codes are never split into parts.
        self.assertEqual(_decode(8, "exact", codes), ("unknown", [], [8]))


class TestValidateCodes(unittest.TestCase):
    @staticmethod
    def _codes(*pairs):
        return [SimpleNamespace(code=c, kind=k) for c, k in pairs]

    def test_bam_codes_are_valid(self):
        self.assertEqual(validate_codes("bitmask", BAM_CODES), [])

    def test_bitmask_codes_must_be_single_bits(self):
        errors = validate_codes("bitmask", self._codes((1, "fault"), (3, "fault")))
        self.assertEqual(len(errors), 1)
        self.assertIn("Code 3 is not a single bit", errors[0])

    def test_bitmask_zero_must_be_ok_and_only_zero_can_be_ok(self):
        self.assertEqual(len(validate_codes("bitmask", self._codes((0, "fault")))), 1)
        self.assertEqual(len(validate_codes("bitmask", self._codes((4, "ok")))), 1)

    def test_duplicate_codes(self):
        errors = validate_codes("exact", self._codes((2, "fault"), (2, "info")))
        self.assertEqual(errors, ["Code 2 is listed more than once."])

    def test_exact_allows_any_codes(self):
        self.assertEqual(validate_codes("exact", self._codes((0, "ok"), (3, "info"), (7, "ok"))), [])


class StatusCodeDBTestCase(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        self.tables = [Vendor.__table__, DeviceProfile.__table__, StatusCodeSet.__table__, StatusCode.__table__]
        Base.metadata.create_all(self.engine, tables=self.tables)
        self.Session = sessionmaker(bind=self.engine)

    def tearDown(self):
        Base.metadata.drop_all(self.engine, tables=self.tables)


class TestStatusCodeSetAPI(StatusCodeDBTestCase):
    def setUp(self):
        super().setUp()

        def override_get_db():
            session = self.Session()
            try:
                yield session
            finally:
                session.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.pop(get_db, None)
        super().tearDown()

    def _create(self, **overrides):
        payload = {
            "name": "bam-1020",
            "description": "BAM status codes",
            "decode_rule": "bitmask",
            "codes": [{k: v for k, v in c.items()} for c in BAM_STATUS_CODES],
        }
        payload.update(overrides)
        return self.client.post("/api/v1/status-code-sets/", json=payload)

    def test_create_get_list_and_delete(self):
        created = self._create()
        self.assertEqual(created.status_code, 201)
        body = created.json()
        self.assertEqual(body["decode_rule"], "bitmask")
        self.assertEqual([c["code"] for c in body["codes"]], [0, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512])

        by_name = self.client.get("/api/v1/status-code-sets/bam-1020").json()
        by_id = self.client.get(f"/api/v1/status-code-sets/{body['id']}").json()
        self.assertEqual(by_name["id"], body["id"])
        self.assertEqual(by_id["name"], "bam-1020")
        self.assertEqual([s["name"] for s in self.client.get("/api/v1/status-code-sets/?search=bam").json()], ["bam-1020"])

        self.assertEqual(self.client.delete("/api/v1/status-code-sets/bam-1020").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/status-code-sets/bam-1020").status_code, 404)

    def test_duplicate_name_is_409(self):
        self._create()
        response = self._create()
        self.assertEqual(response.status_code, 409)

    def test_invalid_bitmask_codes_are_422(self):
        response = self._create(codes=[{"code": 3, "label": "Bad"}])
        self.assertEqual(response.status_code, 422)
        self.assertIn("Code 3 is not a single bit", response.json()["detail"][0])

    def test_update_keeps_omitted_fields_and_replaces_codes(self):
        self._create()
        renamed = self.client.patch("/api/v1/status-code-sets/bam-1020", json={"description": "Updated"}).json()
        self.assertEqual(renamed["description"], "Updated")
        self.assertEqual(len(renamed["codes"]), 11)

        replaced = self.client.patch("/api/v1/status-code-sets/bam-1020", json={"codes": [
            {"code": 0, "label": "Functional", "kind": "ok"},
            {"code": 16, "label": "Flow Failure", "description": "Low flow"},
        ]}).json()
        self.assertEqual([(c["code"], c["kind"]) for c in replaced["codes"]], [(0, "ok"), (16, "fault")])
        self.assertEqual(replaced["description"], "Updated")

    def test_switching_rule_validates_existing_codes(self):
        self._create(name="pump", decode_rule="exact", codes=[
            {"code": 0, "label": "OK", "kind": "ok"},
            {"code": 3, "label": "Calibrating", "kind": "info"},
        ])
        response = self.client.patch("/api/v1/status-code-sets/pump", json={"decode_rule": "bitmask"})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.client.get("/api/v1/status-code-sets/pump").json()["decode_rule"], "exact")

    def test_rename_to_existing_name_is_409(self):
        self._create()
        self._create(name="other", codes=[])
        response = self.client.patch("/api/v1/status-code-sets/other", json={"name": "bam-1020"})
        self.assertEqual(response.status_code, 409)

    def test_decode_endpoint(self):
        self._create()
        body = self.client.get("/api/v1/status-code-sets/bam-1020/decode?value=17&value=0&value=1040&value=abc").json()
        self.assertEqual(body["code_set"], "bam-1020")
        results = body["results"]
        self.assertEqual(results[0]["status"], "fault")
        self.assertEqual([c["label"] for c in results[0]["codes"]], ["Tape Break", "Flow Failure"])
        self.assertTrue(results[0]["codes"][1]["description"].startswith("Sample flow"))
        self.assertEqual(results[1]["status"], "ok")
        self.assertEqual(results[1]["codes"][0]["label"], "Functional")
        self.assertEqual(results[2]["unknown_codes"], [1024])
        self.assertEqual(results[3]["status"], "invalid")

    def test_decode_unknown_set_is_404(self):
        response = self.client.get("/api/v1/status-code-sets/nope/decode?value=1")
        self.assertEqual(response.status_code, 404)


class TestStatusCodeSeeds(StatusCodeDBTestCase):
    def test_seed_creates_bam_set_once(self):
        db = self.Session()
        try:
            seed_status_code_sets(db)
            seed_status_code_sets(db)
            db.commit()
            sets = db.query(StatusCodeSet).all()
            self.assertEqual([s.name for s in sets], ["bam-1020"])
            self.assertEqual(len(sets[0].codes), 11)
        finally:
            db.close()

    def test_new_bam_profiles_point_status_at_the_set(self):
        self.assertEqual(BAM_TELEMETRY_MAPPINGS["field6"]["status_code_set"], "bam-1020")

    def test_existing_profile_is_linked_only_when_unlinked(self):
        profile = DeviceProfile(name="bam", category="reference_monitor", telemetry_mappings={
            "field6": {"key": "device_status", "label": "BAM Status Code"},
        })
        _link_status_code_set(profile, "field6", "device_status", "bam-1020")
        self.assertEqual(profile.telemetry_mappings["field6"]["status_code_set"], "bam-1020")

        custom = DeviceProfile(name="bam2", category="reference_monitor", telemetry_mappings={
            "field6": {"key": "device_status", "status_code_set": "bam-1022"},
            "field7": {"key": "battery_voltage"},
        })
        _link_status_code_set(custom, "field6", "device_status", "bam-1020")
        _link_status_code_set(custom, "field7", "device_status", "bam-1020")
        self.assertEqual(custom.telemetry_mappings["field6"]["status_code_set"], "bam-1022")
        self.assertNotIn("status_code_set", custom.telemetry_mappings["field7"])


if __name__ == "__main__":
    unittest.main()
