"""Resolve the training owner through the AirQo auth service."""

import os
import re
from functools import wraps
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import g, jsonify, request


def verified_owner(token):
    """Ask auth-service to verify a login JWT and return its user ID."""
    base_url = os.getenv("AUTH_SERVICE_URL", "").rstrip("/")
    if not base_url:
        return None, 503
    verification = Request(base_url + "/api/v2/users/verify", data=b"",
                           headers={"Authorization": "JWT " + token}, method="POST")
    try:
        with urlopen(verification, timeout=5) as response:
            owner = response.headers.get("X-Auth-User-Id", "")
            if not re.fullmatch(r"[0-9a-fA-F]{24}", owner):
                return None, 503
            return owner.lower(), None
    except HTTPError as exc:
        return None, 401 if exc.code in (401, 403) else 503
    except (URLError, TimeoutError):
        return None, 503


def optional_owner():
    """Identify a signed caller when supplied, while allowing anonymous public reads."""
    parts = request.headers.get("Authorization", "").split()
    if not parts:
        return None, None
    if len(parts) != 2 or parts[0].lower() not in {"bearer", "jwt"}:
        return None, 401
    return verified_owner(parts[1])


def login_required(view):
    @wraps(view)
    def authenticated(*args, **kwargs):
        if not os.getenv("AUTH_SERVICE_URL"):
            return jsonify(success=False, message="AirQo authentication is unavailable."), 503
        parts = request.headers.get("Authorization", "").split()
        if len(parts) != 2 or parts[0].lower() not in {"bearer", "jwt"}:
            return jsonify(success=False, message="An AirQo login token is required."), 401
        owner, failure = verified_owner(parts[1])
        if failure == 401:
            return jsonify(success=False, message="Invalid or expired AirQo login token."), 401
        if failure == 503:
            return jsonify(success=False, message="AirQo authentication is not configured."), 503
        g.training_owner = owner
        return view(*args, **kwargs)

    return authenticated
