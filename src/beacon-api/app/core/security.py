"""
Platform JWT verification.

Users sign in on the AirQo platform (auth-service), which issues HS256 JWTs
signed with the platform's ``JWT_SECRET``. Clients send them as
``Authorization: JWT <token>``. The platform's own gateway verifies every
request through auth-service, but beacon is not behind that gateway, so it
verifies the tokens itself with the same secret and the same rules:

- the scheme is ``JWT`` (case-insensitive) followed by the token;
- the signature must be a valid HS256 signature made with ``JWT_SECRET``;
- an expired token is still accepted for ``JWT_GRACE_PERIOD_SECONDS`` after
  ``exp`` (auth-service's grace period, five minutes by default);
- a token without ``exp`` is accepted, as auth-service accepts it.

Verification is on by default and fails closed: with no ``JWT_SECRET``
configured, every request that needs a token is refused with 503 instead of
being let through. ``JWT_VERIFICATION_ENABLED=false`` turns verification off
for local development only; routes then behave as they did before this
module existed (prefix check, unverified user id, open write routes).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

import jwt
from fastapi import Header, HTTPException, Request, status

from app.core.config import settings

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"
WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
_AUTH_HEADER_RE = re.compile(r"^JWT\s+(.+)$", re.IGNORECASE)


@dataclass(frozen=True)
class AuthenticatedUser:
    """The caller behind a platform JWT."""

    token: str                      # the JWT without its scheme, for forwarding to the platform
    user_id: Optional[str]
    claims: Dict[str, Any] = field(default_factory=dict)
    verified: bool = True           # False only when verification is turned off


# ── Settings ──────────────────────────────────────────────────────────────────

def verification_enabled() -> bool:
    return bool(getattr(settings, "JWT_VERIFICATION_ENABLED", True))


def _secret() -> str:
    return (getattr(settings, "JWT_SECRET", "") or "").strip()


def _grace_seconds() -> int:
    try:
        return max(0, int(getattr(settings, "JWT_GRACE_PERIOD_SECONDS", 300)))
    except (TypeError, ValueError):
        return 300


def describe_auth_mode() -> str:
    """One line for the startup log saying how requests are authenticated."""
    if not verification_enabled():
        return (
            "JWT verification is DISABLED (JWT_VERIFICATION_ENABLED=false): tokens are only "
            "checked for the 'JWT ' prefix. Use this for local development only."
        )
    if not _secret():
        return (
            "JWT verification is enabled but JWT_SECRET is not set: every request that needs "
            "a token will be refused with 503 until it is configured."
        )
    return "JWT verification is enabled (HS256, platform JWT_SECRET)."


# ── Parsing and verification ──────────────────────────────────────────────────

def _unauthorized(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=message,
        headers={"WWW-Authenticate": "JWT"},
    )


def parse_authorization_header(authorization: Optional[str]) -> str:
    """The token from an ``Authorization: JWT <token>`` header, or 401."""
    if not authorization or not authorization.strip():
        raise _unauthorized("Authorization header is missing")
    match = _AUTH_HEADER_RE.match(authorization.strip())
    if not match or not match.group(1).strip():
        raise _unauthorized("Invalid authorization header format. Expected 'JWT <token>'")
    return match.group(1).strip()


def _user_id(claims: Dict[str, Any]) -> Optional[str]:
    # auth-service reads decoded.userId || decoded.id || decoded._id
    for key in ("userId", "id", "_id"):
        value = claims.get(key)
        if value:
            return str(value)
    return None


def _unverified_claims(token: str) -> Dict[str, Any]:
    try:
        claims = jwt.decode(token, options={"verify_signature": False})
    except jwt.PyJWTError:
        return {}
    return claims if isinstance(claims, dict) else {}


def verify_token(token: str) -> AuthenticatedUser:
    """
    Verify a platform JWT and return its caller.

    Raises 401 for a malformed, badly signed or expired token, and 503 when
    verification is enabled but no ``JWT_SECRET`` is configured.
    """
    if not verification_enabled():
        claims = _unverified_claims(token)
        return AuthenticatedUser(token=token, user_id=_user_id(claims), claims=claims, verified=False)

    secret = _secret()
    if not secret:
        logger.error("Rejecting an authenticated request: JWT verification is enabled but JWT_SECRET is not set")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured on this server",
        )

    try:
        claims = jwt.decode(
            token,
            secret,
            algorithms=[ALGORITHM],
            leeway=_grace_seconds(),
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Your session has expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise _unauthorized("Invalid token")

    if not isinstance(claims, dict):
        raise _unauthorized("Invalid token")
    return AuthenticatedUser(token=token, user_id=_user_id(claims), claims=claims, verified=True)


def extract_verified_token(authorization: Optional[str]) -> str:
    """
    Parse ``Authorization: JWT <token>``, verify the token, and return it
    without the scheme (handlers forward it to the platform as-is).
    """
    token = parse_authorization_header(authorization)
    verify_token(token)
    return token


def verify_ws_token(token: Optional[str]) -> Optional[str]:
    """
    The user id behind a websocket ``token`` query parameter (``JWT <token>``
    or the bare token), or None when it is missing or does not verify.
    """
    if not token or not token.strip():
        return None
    raw = token.strip()
    match = _AUTH_HEADER_RE.match(raw)
    if match:
        raw = match.group(1).strip()
    try:
        return verify_token(raw).user_id
    except HTTPException:
        return None


# ── FastAPI dependencies ──────────────────────────────────────────────────────

def get_current_user(authorization: str = Header(...)) -> AuthenticatedUser:
    """Dependency: the verified caller of a route that requires a token."""
    return verify_token(parse_authorization_header(authorization))


def get_current_user_id(authorization: str = Header(...)) -> str:
    """Dependency: the verified caller's platform user id."""
    user = get_current_user(authorization)
    if not user.user_id:
        raise _unauthorized("Token does not identify a user")
    return user.user_id


def enforce_jwt_on_writes(request: Request, authorization: Optional[str] = Header(None)) -> None:
    """
    Router-level dependency: every POST, PUT, PATCH or DELETE needs a verified
    token. Reads keep their own per-route rules. A no-op when verification is
    turned off, so local development keeps working without tokens.
    """
    if not verification_enabled() or request.method.upper() not in WRITE_METHODS:
        return
    verify_token(parse_authorization_header(authorization))
