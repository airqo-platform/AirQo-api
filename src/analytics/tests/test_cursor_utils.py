"""
Tests for the signed pagination cursor (api/utils/cursor_utils.py).

A cursor is signed JSON that names the BigQuery job whose stored result holds
the pages, the row offset of the next page, the hash of the request that
produced it, and an expiry.  ``read_cursor`` accepts the token that the
service issued and rejects every other token that a client can send with
``CursorRejected``.
"""

from __future__ import annotations

import pytest

from api.utils.cursor_utils import CursorUtils, StoredResultCursor
from api.utils.exceptions import CursorRejected
from tests.paging_support import (
    LOCATION,
    payload_of,
    tampered,
    unsigned,
    with_changed_payload,
)

JOB_ID = "job_2026_1"
REQUEST_HASH = "f" * 64
OTHER_HASH = "0" * 64


def _token() -> str:
    """Issue the token that the service returns for the page at offset 3."""
    return CursorUtils.create_cursor(JOB_ID, LOCATION, 3, REQUEST_HASH)


# ---------------------------------------------------------------------------
# Round trip
# ---------------------------------------------------------------------------


class TestCursorRoundTrip:
    def test_read_returns_the_fields_create_was_given(self, cursor_clock):
        assert CursorUtils.read_cursor(_token(), REQUEST_HASH) == StoredResultCursor(
            job_id=JOB_ID, location=LOCATION, offset=3, fingerprint=REQUEST_HASH
        )

    def test_payload_is_signed_json(self, cursor_clock):
        token = _token()
        payload_b64, sep, signature = token.rpartition(".")
        assert sep == "." and payload_b64 and signature
        assert set(payload_of(token)) == {
            "expires",
            "fingerprint",
            "job_id",
            "location",
            "offset",
        }

    def test_fingerprint_is_the_same_for_equal_mappings(self):
        first = CursorUtils.fingerprint({"b": 1, "a": [1, 2]})
        second = CursorUtils.fingerprint({"a": [1, 2], "b": 1})
        assert first == second
        assert len(first) == 64
        assert CursorUtils.fingerprint({"a": [2, 1], "b": 1}) != first


# ---------------------------------------------------------------------------
# Lifetime
# ---------------------------------------------------------------------------


class TestCursorLifetime:
    def test_lifetime_is_six_minutes(self, cursor_clock):
        assert CursorUtils.CURSOR_EXPIRATION == 360
        assert payload_of(_token())["expires"] == int(cursor_clock.time()) + 360

    def test_token_is_valid_until_its_expiry(self, cursor_clock):
        token = _token()
        cursor_clock.advance(359)
        CursorUtils.read_cursor(token, REQUEST_HASH)
        cursor_clock.advance(2)
        with pytest.raises(CursorRejected):
            CursorUtils.read_cursor(token, REQUEST_HASH)

    def test_expiry_cannot_be_extended_without_the_key(self, cursor_clock):
        later = with_changed_payload(
            _token(), expires=int(cursor_clock.time()) + 10_000
        )
        with pytest.raises(CursorRejected):
            CursorUtils.read_cursor(later, REQUEST_HASH)


# ---------------------------------------------------------------------------
# Rejected tokens: every form that a client can send apart from the issued one
# ---------------------------------------------------------------------------

REJECTED = {
    "changed payload": tampered,
    "forged signature": lambda token: f"{unsigned(token)}.deadbeef",
    "no signature": unsigned,
    "arbitrary text": lambda token: "not-a-cursor",
    "signature outside ascii": lambda token: f"{unsigned(token)}.ñ",
    "lone surrogate in the signature": lambda token: f"{unsigned(token)}.\ud800",
    "lone surrogate in the payload": lambda token: "\ud800.x",
}


class TestRejectedTokens:
    @pytest.mark.parametrize("make_token", REJECTED.values(), ids=REJECTED.keys())
    def test_rejected_token_raises(self, cursor_clock, make_token):
        with pytest.raises(CursorRejected):
            CursorUtils.read_cursor(make_token(_token()), REQUEST_HASH)

    def test_token_from_another_key_is_rejected(self, cursor_clock, monkeypatch):
        token = _token()
        monkeypatch.setattr(
            CursorUtils, "_signing_key", staticmethod(lambda: b"another-key")
        )
        with pytest.raises(CursorRejected):
            CursorUtils.read_cursor(token, REQUEST_HASH)

    def test_token_of_another_request_is_rejected(self, cursor_clock):
        with pytest.raises(CursorRejected):
            CursorUtils.read_cursor(_token(), OTHER_HASH)
