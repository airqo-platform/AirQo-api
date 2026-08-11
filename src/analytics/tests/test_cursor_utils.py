"""
Tests for pagination cursor utilities (api/utils/cursor_utils.py).

StatelessCursorUtils is the cursor implementation actually used by the
FastAPI path (`CursorUtils = StatelessCursorUtils`) — it's self-contained
(base64 + embedded expiry), so its tests need no mocking at all.

The legacy Redis-backed cursor implementation was removed with the rest
of the Flask-era code — stateless tokens are the only implementation.
"""

from __future__ import annotations

import base64
import time
import pytest

from api.utils.cursor_utils import CursorUtils, StatelessCursorUtils


# ---------------------------------------------------------------------------
# StatelessCursorUtils — the live implementation (CursorUtils alias)
# ---------------------------------------------------------------------------


class TestStatelessCursorUtils:
    def test_create_and_retrieve_minimal(self):
        cursor = StatelessCursorUtils.create_cursor("2025-01-01 00:00:00Z", "device1")
        assert isinstance(cursor, str)
        assert len(cursor) > 0
        assert (
            StatelessCursorUtils.retrieve_cursor(cursor)
            == "2025-01-01 00:00:00Z|device1"
        )

    def test_create_and_retrieve_with_device_id(self):
        cursor = StatelessCursorUtils.create_cursor(
            "2025-01-01 00:00:00Z", "site1", "device1"
        )
        assert (
            StatelessCursorUtils.retrieve_cursor(cursor)
            == "2025-01-01 00:00:00Z|site1|device1"
        )

    def test_validate_cursor_valid(self):
        token = StatelessCursorUtils.create_cursor("2025-01-01 00:00:00Z", "device1")
        assert StatelessCursorUtils.validate_cursor(token) is True

    @staticmethod
    def _sign_payload(payload: str) -> str:
        """Build a correctly signed token from a raw payload, so expiry/format
        tests exercise those paths rather than failing at the signature."""
        payload_b64 = (
            base64.urlsafe_b64encode(payload.encode()).decode("utf-8").rstrip("=")
        )
        return f"{payload_b64}.{StatelessCursorUtils._sign(payload_b64)}"

    def test_validate_cursor_expired(self):
        expired_time = int(time.time()) - 100
        expired_token = self._sign_payload(
            f"2025-01-01 00:00:00Z|device1|{expired_time}"
        )

        assert StatelessCursorUtils.validate_cursor(expired_token) is False
        with pytest.raises(ValueError, match="expired"):
            StatelessCursorUtils.retrieve_cursor(expired_token)

    def test_parse_cursor_with_device_id(self):
        token = StatelessCursorUtils.create_cursor(
            "2025-01-01 00:00:00Z", "site1", "device1"
        )
        assert StatelessCursorUtils.parse_cursor(token) == {
            "timestamp": "2025-01-01 00:00:00Z",
            "filter_value": "site1",
            "device_id": "device1",
        }

    def test_parse_cursor_without_device_id(self):
        token = StatelessCursorUtils.create_cursor("2025-01-01 00:00:00Z", "device1")
        parsed = StatelessCursorUtils.parse_cursor(token)
        assert parsed == {
            "timestamp": "2025-01-01 00:00:00Z",
            "filter_value": "device1",
        }
        assert "device_id" not in parsed

    def test_retrieve_cursor_invalid_format_raises(self):
        invalid_token = self._sign_payload("invalid_data")
        with pytest.raises(ValueError, match="Invalid cursor format"):
            StatelessCursorUtils.retrieve_cursor(invalid_token)

    def test_retrieve_cursor_garbage_token_raises(self):
        with pytest.raises(ValueError):
            StatelessCursorUtils.retrieve_cursor("not-valid-base64!!!")


# ---------------------------------------------------------------------------
# Signature enforcement
#
# The cursor payload ends up in the WHERE clause of a BigQuery query, so an
# unsigned token let a caller both inject filter values and — since the expiry
# lives inside the payload — mint themselves a never-expiring cursor.
# ---------------------------------------------------------------------------


class TestCursorSignature:
    def test_token_carries_a_signature(self):
        token = StatelessCursorUtils.create_cursor("2025-01-01 00:00:00Z", "device1")
        payload_b64, sep, signature = token.rpartition(".")
        assert sep == "." and payload_b64 and signature

    def test_unsigned_legacy_token_is_rejected(self):
        """The pre-HMAC token format (bare base64) must no longer verify."""
        payload = f"2025-01-01 00:00:00Z|device1|{int(time.time()) + 300}"
        legacy = base64.urlsafe_b64encode(payload.encode()).decode("utf-8").rstrip("=")

        assert StatelessCursorUtils.validate_cursor(legacy) is False
        with pytest.raises(ValueError, match="Invalid or expired cursor token"):
            StatelessCursorUtils.retrieve_cursor(legacy)

    def test_tampered_payload_is_rejected(self):
        token = StatelessCursorUtils.create_cursor("2025-01-01 00:00:00Z", "device1")
        payload_b64, _, signature = token.rpartition(".")
        forged = f"{payload_b64[:-4]}AAAA.{signature}"

        assert StatelessCursorUtils.validate_cursor(forged) is False

    def test_forged_signature_is_rejected(self):
        token = StatelessCursorUtils.create_cursor("2025-01-01 00:00:00Z", "device1")
        payload_b64, _, _ = token.rpartition(".")

        assert StatelessCursorUtils.validate_cursor(f"{payload_b64}.deadbeef") is False

    def test_expiry_cannot_be_extended_by_re_encoding(self):
        """Re-encoding the payload with a distant expiry invalidates the
        signature — the whole point of signing an embedded expiry."""
        far_future = int(time.time()) + 10_000_000
        payload = f"2025-01-01 00:00:00Z|device1|{far_future}"
        forged = base64.urlsafe_b64encode(payload.encode()).decode("utf-8").rstrip("=")

        assert StatelessCursorUtils.validate_cursor(forged) is False

    def test_signature_is_key_dependent(self, monkeypatch):
        """A token minted under a different SECRET_KEY must not verify."""
        token = StatelessCursorUtils.create_cursor("2025-01-01 00:00:00Z", "device1")
        monkeypatch.setattr(
            StatelessCursorUtils,
            "_signing_key",
            staticmethod(lambda: b"a-different-key"),
        )
        assert StatelessCursorUtils.validate_cursor(token) is False

    def test_cursor_utils_alias_is_stateless(self):
        """CursorUtils must point at StatelessCursorUtils — the FastAPI path
        (bigquery_api.py, async_bigquery_api.py) relies on this alias."""
        assert CursorUtils is StatelessCursorUtils
