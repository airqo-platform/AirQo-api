"""Verify AirQo user JWTs; never accept an owner ID supplied in form data."""

import os
import re
from functools import wraps

import jwt
from flask import g, jsonify, request


def login_required(view):
    @wraps(view)
    def authenticated(*args, **kwargs):
        secret = os.getenv("JWT_SECRET")
        if not secret:
            return jsonify(success=False, message="Training authentication is not configured."), 503
        parts = request.headers.get("Authorization", "").split()
        if len(parts) != 2 or parts[0].lower() not in {"bearer", "jwt"}:
            return jsonify(success=False, message="An AirQo login token is required."), 401
        try:
            options = {"require": ["exp", "_id"]}
            claims = jwt.decode(parts[1], secret, algorithms=["HS256"], options=options)
            owner = claims["_id"]
            if not isinstance(owner, str) or not re.fullmatch(r"[0-9a-fA-F]{24}", owner):
                raise jwt.InvalidTokenError("Expected an AirQo user ID")
        except jwt.InvalidTokenError:
            return jsonify(success=False, message="Invalid or expired AirQo login token."), 401
        g.training_owner = owner.lower()
        return view(*args, **kwargs)

    return authenticated
