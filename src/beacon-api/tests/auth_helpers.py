"""
Signed platform JWTs for tests, and a switch that turns verification on.

Tokens are signed exactly like auth-service signs them (HS256 with the
platform secret), so tests exercise the real verification path in
``app.core.security`` rather than bypassing it.
"""
import time
import unittest
from typing import Any, Dict, Optional
from unittest.mock import patch

import jwt

from app.core.config import settings

TEST_JWT_SECRET = "beacon-test-jwt-secret"
TEST_USER_ID = "693a517028a4f800136155d3"


def make_token(
    user_id: str = TEST_USER_ID,
    *,
    expires_in: Optional[int] = 3600,
    secret: str = TEST_JWT_SECRET,
    algorithm: str = "HS256",
    **claims: Any,
) -> str:
    """A platform-style JWT. ``expires_in=None`` leaves out ``exp``; negative values make it expired."""
    now = int(time.time())
    payload: Dict[str, Any] = {"_id": user_id, "email": "tester@airqo.net", "iat": now, **claims}
    if expires_in is not None:
        payload["exp"] = now + expires_in
    return jwt.encode(payload, secret, algorithm=algorithm)


def auth_headers(token: Optional[str] = None) -> Dict[str, str]:
    return {"Authorization": f"JWT {token or make_token()}"}


def jwt_verification(enabled: bool = True, secret: str = TEST_JWT_SECRET):
    """A patcher that sets the verification mode and secret on the shared settings."""
    return patch.multiple(settings, JWT_VERIFICATION_ENABLED=enabled, JWT_SECRET=secret)


def enable_jwt_verification(test: unittest.TestCase, secret: str = TEST_JWT_SECRET) -> None:
    """Turn verification on for the rest of ``test``; undone automatically after it."""
    patcher = jwt_verification(True, secret)
    patcher.start()
    test.addCleanup(patcher.stop)
