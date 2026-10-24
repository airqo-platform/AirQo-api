"""
Platform JWT verification: the shared helpers in app.core.security, the
router-level enforcement on writes, the prefix-check routes that now verify,
and the websocket token check.
"""
import time
import unittest
import uuid
from unittest.mock import AsyncMock, patch

import jwt
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.websockets import WebSocketDisconnect

from app.core import security
from app.core.config import settings
from app.db.session import Base, get_db
from main import app
from tests.auth_helpers import (
    TEST_JWT_SECRET,
    TEST_USER_ID,
    auth_headers,
    enable_jwt_verification,
    jwt_verification,
    make_token,
)


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


class TestParseAuthorizationHeader(unittest.TestCase):
    def test_accepts_the_jwt_scheme_in_any_case(self):
        self.assertEqual(security.parse_authorization_header("JWT abc.def.ghi"), "abc.def.ghi")
        self.assertEqual(security.parse_authorization_header("jwt   abc.def.ghi  "), "abc.def.ghi")

    def test_rejects_missing_or_malformed_headers(self):
        for value in (None, "", "   ", "JWT", "JWT   ", "Bearer abc.def.ghi", "abc.def.ghi"):
            with self.subTest(value=value):
                with self.assertRaises(HTTPException) as ctx:
                    security.parse_authorization_header(value)
                self.assertEqual(ctx.exception.status_code, 401)


class TestVerifyToken(unittest.TestCase):
    def setUp(self):
        enable_jwt_verification(self)

    def assert_unauthorized(self, token, message=None):
        with self.assertRaises(HTTPException) as ctx:
            security.verify_token(token)
        self.assertEqual(ctx.exception.status_code, 401)
        if message:
            self.assertIn(message, ctx.exception.detail)

    def test_valid_token_returns_the_user(self):
        user = security.verify_token(make_token())
        self.assertTrue(user.verified)
        self.assertEqual(user.user_id, TEST_USER_ID)
        self.assertEqual(user.claims["email"], "tester@airqo.net")

    def test_wrong_secret_is_rejected(self):
        self.assert_unauthorized(make_token(secret="some-other-secret"), "Invalid token")

    def test_tampered_payload_is_rejected(self):
        header, _payload, signature = make_token().split(".")
        forged_payload = make_token("someone-else").split(".")[1]
        self.assert_unauthorized(f"{header}.{forged_payload}.{signature}", "Invalid token")

    def test_unsigned_and_other_algorithms_are_rejected(self):
        unsigned = jwt.encode({"_id": TEST_USER_ID}, None, algorithm="none")
        self.assert_unauthorized(unsigned, "Invalid token")
        self.assert_unauthorized(make_token(algorithm="HS512"), "Invalid token")

    def test_garbage_is_rejected(self):
        self.assert_unauthorized("not-a-jwt", "Invalid token")

    def test_expiry_honours_the_grace_period(self):
        # auth-service accepts a token for JWT_GRACE_PERIOD_SECONDS (5 min) after exp
        self.assertTrue(security.verify_token(make_token(expires_in=-60)).verified)
        self.assert_unauthorized(make_token(expires_in=-(settings.JWT_GRACE_PERIOD_SECONDS + 60)), "expired")

    def test_token_without_exp_is_accepted_like_auth_service(self):
        self.assertEqual(security.verify_token(make_token(expires_in=None)).user_id, TEST_USER_ID)

    def test_user_id_claim_precedence(self):
        self.assertEqual(security.verify_token(make_token(userId="u-1")).user_id, "u-1")
        self.assertEqual(security.verify_token(make_token(id="i-1")).user_id, "i-1")

    def test_missing_secret_fails_closed(self):
        with jwt_verification(True, secret=""):
            with self.assertRaises(HTTPException) as ctx:
                security.verify_token(make_token())
        self.assertEqual(ctx.exception.status_code, 503)

    def test_disabled_mode_reads_claims_without_verifying(self):
        with jwt_verification(False):
            user = security.verify_token(make_token(secret="anything"))
        self.assertFalse(user.verified)
        self.assertEqual(user.user_id, TEST_USER_ID)


class TestDependenciesAndWebsocketHelper(unittest.TestCase):
    def setUp(self):
        enable_jwt_verification(self)

    def test_get_current_user_id(self):
        self.assertEqual(security.get_current_user_id(f"JWT {make_token()}"), TEST_USER_ID)
        with self.assertRaises(HTTPException) as ctx:
            security.get_current_user_id(f"JWT {make_token(secret='forged')}")
        self.assertEqual(ctx.exception.status_code, 401)
        no_user = jwt.encode({"exp": int(time.time()) + 60}, TEST_JWT_SECRET, algorithm="HS256")
        with self.assertRaises(HTTPException):
            security.get_current_user_id(f"JWT {no_user}")

    def test_extract_verified_token_returns_the_bare_token(self):
        token = make_token()
        self.assertEqual(security.extract_verified_token(f"JWT {token}"), token)

    def test_verify_ws_token(self):
        token = make_token()
        self.assertEqual(security.verify_ws_token(f"JWT {token}"), TEST_USER_ID)
        self.assertEqual(security.verify_ws_token(token), TEST_USER_ID)
        self.assertIsNone(security.verify_ws_token(make_token(secret="forged")))
        self.assertIsNone(security.verify_ws_token(None))
        self.assertIsNone(security.verify_ws_token(""))


class TestRouteEnforcement(unittest.TestCase):
    """End to end through the app: who gets in, who gets 401 / 503."""

    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)

        def override_get_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)
        enable_jwt_verification(self)

    def tearDown(self):
        app.dependency_overrides.clear()
        self.engine.dispose()

    def _create_vendor(self, **kwargs):
        return self.client.post("/api/v1/vendors/", json={"name": f"Vendor {uuid.uuid4().hex[:6]}"}, **kwargs)

    def test_write_without_a_token_is_rejected(self):
        response = self._create_vendor()
        self.assertEqual(response.status_code, 401, response.text)
        self.assertEqual(response.headers.get("WWW-Authenticate"), "JWT")

    def test_write_with_a_forged_token_is_rejected(self):
        response = self._create_vendor(headers=auth_headers(make_token(secret="forged")))
        self.assertEqual(response.status_code, 401, response.text)

    def test_write_with_a_valid_token_goes_through(self):
        response = self._create_vendor(headers=auth_headers())
        self.assertEqual(response.status_code, 201, response.text)

    def test_unprefixed_route_is_protected_too(self):
        # The API router is also mounted without the /api/v1 prefix
        response = self.client.post("/vendors/", json={"name": "No prefix"})
        self.assertEqual(response.status_code, 401, response.text)

    def test_reads_keep_their_own_rules(self):
        self.assertEqual(self.client.get("/api/v1/vendors/").status_code, 200)

    def test_manufacturer_profile_seed_needs_a_token(self):
        # Flagged by CodeRabbit on PR #7126: it wrote to the database without any check
        self.assertEqual(self.client.post("/api/v1/networks/profiles/seed").status_code, 401)
        self.assertEqual(self.client.post("/api/v1/networks/profiles/seed", headers=auth_headers()).status_code, 200)

    def test_prefix_checked_route_now_verifies_the_signature(self):
        with patch("app.services.thingspeak_sync_service.sync_device_data", new=AsyncMock(return_value={})):
            forged = self.client.post("/api/v1/data-sync/sync-thingspeak", headers=auth_headers(make_token(secret="forged")))
            valid = self.client.post("/api/v1/data-sync/sync-thingspeak", headers=auth_headers())
        self.assertEqual(forged.status_code, 401, forged.text)
        self.assertEqual(valid.status_code, 200, valid.text)

    def test_operations_reject_a_forged_user_token(self):
        # The user id used to be read from the token without checking its signature
        forged = make_token("victim-user", secret="forged")
        response = self.client.get("/api/v1/sessions", headers=auth_headers(forged))
        self.assertEqual(response.status_code, 401, response.text)

    def test_session_websocket_rejects_a_forged_token(self):
        forged = make_token("victim-user", secret="forged")
        with self.client.websocket_connect(f"/ws/sessions/{uuid.uuid4()}?token=JWT%20{forged}") as ws:
            with self.assertRaises(WebSocketDisconnect) as ctx:
                ws.receive_text()
        self.assertEqual(ctx.exception.code, 1008)

    def test_missing_secret_fails_closed_on_writes(self):
        with jwt_verification(True, secret=""):
            response = self._create_vendor(headers=auth_headers())
        self.assertEqual(response.status_code, 503, response.text)

    def test_disabled_mode_keeps_local_development_open(self):
        with jwt_verification(False):
            response = self._create_vendor()
        self.assertEqual(response.status_code, 201, response.text)


if __name__ == "__main__":
    unittest.main()
