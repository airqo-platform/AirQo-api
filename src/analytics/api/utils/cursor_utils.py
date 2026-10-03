"""
Signed pagination cursors.

A cursor names the position of the next page inside the stored result of one
BigQuery query job.  The service signs each cursor and accepts only a cursor
that carries its own signature.
"""

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any, Mapping

from api.utils.exceptions import CursorRejected
from config import settings

#: The longest token that ``read_cursor`` decodes.  A token that the service
#: issues is about 300 characters long.
MAX_TOKEN_LENGTH = 2048

_JSON_SEPARATORS = (",", ":")


def _b64encode(raw: bytes) -> str:
    """Encode ``raw`` as URL-safe base64 without padding."""
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _b64decode(value: str) -> bytes:
    """Decode the URL-safe base64 of :func:`_b64encode` after restoring its padding."""
    padding = len(value) % 4
    if padding:
        value += "=" * (4 - padding)
    return base64.urlsafe_b64decode(value.encode())


def _canonical_json(values: Any) -> str:
    """Serialise ``values`` as JSON with sorted keys and compact separators."""
    return json.dumps(values, sort_keys=True, separators=_JSON_SEPARATORS)


@dataclass(frozen=True)
class StoredResultCursor:
    """
    StoredResultCursor names the position of the next page inside the stored
    result of one query job.

    Attributes:
        job_id: The id of the BigQuery job whose result holds the pages.
        location: The location of that job.
        offset: The zero-based index of the first row of the next page.
        fingerprint: The hash of the request that produced the cursor.
    """

    job_id: str
    location: str
    offset: int
    fingerprint: str


class CursorUtils:
    """
    CursorUtils creates and reads signed pagination cursors.

    A cursor is a JSON object that holds the BigQuery job id, the job
    location, the row offset of the next page, the hash of the request that
    produced it, and an expiry time six minutes after issue.  The service
    encodes the JSON as base64 for transport and signs it with HMAC-SHA256
    under ``settings.secret_key``, so it accepts only a cursor that it issued.

    Token format: ``<b64(json)>.<b64(hmac_sha256(b64(json)))>``.

    ``read_cursor`` raises ``CursorRejected`` for a token that fails any
    check.  The service layer answers it with HTTP 400.
    """

    CURSOR_EXPIRATION = 360  # six minutes

    @staticmethod
    def _signing_key() -> bytes:
        """
        Resolve the HMAC key at call time so tests can swap settings.

        The method accepts a plain str as well as SecretStr, because the test
        config declares ``secret_key`` as str.
        """
        key = settings.secret_key
        return (
            key.get_secret_value() if hasattr(key, "get_secret_value") else str(key)
        ).encode()

    @staticmethod
    def _sign(payload_b64: str) -> str:
        digest = hmac.new(
            CursorUtils._signing_key(), payload_b64.encode(), hashlib.sha256
        ).digest()
        return _b64encode(digest)

    @staticmethod
    def fingerprint(values: Mapping[str, Any]) -> str:
        """
        Compute the SHA-256 hex digest of ``values`` as canonical JSON.

        The serialisation sorts the keys and uses compact separators, so one
        mapping gives one digest in every process.

        Args:
            values: A mapping of JSON-serialisable values.

        Returns:
            str: The digest, 64 hexadecimal characters.
        """
        return hashlib.sha256(_canonical_json(values).encode("utf-8")).hexdigest()

    @staticmethod
    def create_cursor(job_id: str, location: str, offset: int, fingerprint: str) -> str:
        """
        Create the signed token for the page that starts at ``offset``.

        Args:
            job_id: The id of the BigQuery job whose stored result holds the pages.
            location: The location of that job.
            offset: The zero-based index of the first row of the next page.
            fingerprint: The hash of the request that produced the cursor.

        Returns:
            str: The token for ``metadata.next``.
        """
        payload = {
            "expires": int(time.time()) + CursorUtils.CURSOR_EXPIRATION,
            "fingerprint": fingerprint,
            "job_id": job_id,
            "location": location,
            "offset": offset,
        }
        payload_b64 = _b64encode(_canonical_json(payload).encode("utf-8"))
        return f"{payload_b64}.{CursorUtils._sign(payload_b64)}"

    @staticmethod
    def read_cursor(token: str, fingerprint: str) -> StoredResultCursor:
        """
        Verify a token and return the position that it names.

        The checks run in this order: length, format, signature, decoding,
        expiry, and the hash of the request.  Each check that fails raises
        ``CursorRejected`` with a reason for the log.

        Args:
            token: The token that the request carries.
            fingerprint: The hash of the request that carries the token.

        Returns:
            StoredResultCursor: The position of the next page.

        Raises:
            CursorRejected: The token fails one of the checks.
        """
        if not token or len(token) > MAX_TOKEN_LENGTH:
            raise CursorRejected("the token is empty or longer than the limit")

        payload_b64, _, signature = token.rpartition(".")
        if not payload_b64 or not signature:
            raise CursorRejected("the token has no signature")

        try:
            # The comparison runs in constant time on bytes.
            expected = CursorUtils._sign(payload_b64)
            if not hmac.compare_digest(
                signature.encode("utf-8"), expected.encode("ascii")
            ):
                raise CursorRejected("the signature does not match the payload")
            payload = json.loads(_b64decode(payload_b64).decode("utf-8"))
            cursor = StoredResultCursor(
                job_id=str(payload["job_id"]),
                location=str(payload["location"]),
                offset=int(payload["offset"]),
                fingerprint=str(payload["fingerprint"]),
            )
            expires = int(payload["expires"])
        except (KeyError, TypeError, ValueError) as exc:
            # A lone surrogate in the token, a payload outside base64, UTF-8
            # or JSON, and a payload without the five fields all arrive here.
            raise CursorRejected("the token does not decode") from exc

        if int(time.time()) > expires:
            raise CursorRejected("the token has expired")

        if not hmac.compare_digest(
            cursor.fingerprint.encode("utf-8"), fingerprint.encode("utf-8")
        ):
            raise CursorRejected(
                "the request differs from the request that issued the token"
            )

        return cursor
