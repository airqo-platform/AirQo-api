import base64
import hashlib
import hmac
import time
from typing import Optional, Dict, Any
import logging

from config import settings

logger = logging.getLogger(__name__)


def _b64encode(raw: bytes) -> str:
    """URL-safe base64 without padding (padding is restored on decode)."""
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _b64decode(value: str) -> bytes:
    """Inverse of :func:`_b64encode`, restoring stripped padding."""
    padding = len(value) % 4
    if padding:
        value += "=" * (4 - padding)
    return base64.urlsafe_b64decode(value.encode())


class StatelessCursorUtils:
    """
    Utility class for handling pagination cursors in the API using stateless tokens.
    Provides methods for encoding, decoding, and extracting information from cursors.

    Note: This implementation uses stateless tokens.

    Tokens are **HMAC-signed**.  The payload is base64 for transport only,
    which is not a security boundary — anyone can decode and re-encode it.
    The cursor's contents end up in the WHERE clause of a BigQuery query, so
    an unsigned token let a caller inject arbitrary values into the filter
    (and, because the expiry lives inside the payload, extend its own
    lifetime indefinitely).  The signature makes the token tamper-evident;
    binding the parts as query parameters in
    ``BigQueryApi._apply_pagination_cursor`` is the second, independent layer.

    Token format: ``<b64(payload)>.<b64(hmac_sha256(b64(payload)))>``
    """

    CURSOR_EXPIRATION = int(0.1 * 60 * 60)  # Ensure this is an integer (6 minutes)

    @staticmethod
    def _signing_key() -> bytes:
        """
        Resolve the HMAC key at call time so tests can swap settings.

        Accepts a plain str as well as SecretStr — the test config declares
        `secret_key` as str, and a TypeError here would surface as a confusing
        "invalid cursor" rather than a config error.
        """
        key = settings.secret_key
        return (
            key.get_secret_value() if hasattr(key, "get_secret_value") else str(key)
        ).encode()

    @staticmethod
    def _sign(payload_b64: str) -> str:
        digest = hmac.new(
            StatelessCursorUtils._signing_key(), payload_b64.encode(), hashlib.sha256
        ).digest()
        return _b64encode(digest)

    @staticmethod
    def encode_cursor(cursor_str: str) -> str:
        """
        Encodes a cursor string into a signed stateless token with an embedded
        expiration.

        Args:
            cursor_str(str): The raw cursor string to store

        Returns:
            str: Signed stateless cursor token for API response

        Raises:
            ValueError: If the cursor could not be encoded.  This deliberately
                raises rather than returning a random fallback token — a token
                that cannot be decoded later would surface as a confusing
                "invalid cursor" on the *next* request instead of here.
        """
        try:
            expiration = int(time.time()) + StatelessCursorUtils.CURSOR_EXPIRATION
            payload_b64 = _b64encode(f"{cursor_str}|{expiration}".encode())
            return f"{payload_b64}.{StatelessCursorUtils._sign(payload_b64)}"
        except Exception as e:
            logger.error(f"Failed to encode cursor: {e}")
            raise ValueError("Failed to encode pagination cursor")

    @staticmethod
    def retrieve_cursor(token: str) -> str:
        """
        Verifies a stateless cursor token's signature and expiration, then
        returns its payload.

        Args:
            token(str): The cursor token received from a previous API response

        Returns:
            str: The retrieved cursor string containing pagination metadata

        Raises:
            ValueError: If the token is malformed, unsigned, tampered with,
                or has expired.
        """
        try:
            payload_b64, _, signature = token.rpartition(".")
            if not payload_b64 or not signature:
                raise ValueError("Invalid or expired cursor token")

            # Constant-time comparison — a fast-fail compare would leak the
            # signature a byte at a time.
            if not hmac.compare_digest(
                signature, StatelessCursorUtils._sign(payload_b64)
            ):
                raise ValueError("Invalid or expired cursor token")

            decoded = _b64decode(payload_b64).decode("utf-8")
            parts = decoded.rsplit("|", 1)

            if len(parts) != 2:
                raise ValueError("Invalid cursor format")

            cursor_raw, expiration_str = parts[0], parts[1]
            if int(time.time()) > int(expiration_str):
                raise ValueError("Cursor has expired")

            return cursor_raw
        except ValueError as e:
            # Re-raise ValueErrors as they are already specific
            raise e
        except Exception as e:
            logger.debug(f"Cursor retrieval failed: {e}")
            raise ValueError("Invalid or expired cursor token")

    @staticmethod
    def parse_cursor(token: str) -> Dict[str, Any]:
        """
        Retrieves a cursor and parses it into its component parts.

        Args:
            token (str): The cursor token from the API

        Returns:
            Dict: Dictionary with extracted values from the cursor
                - timestamp: The timestamp value
                - filter_value: The filter value (e.g., site_id or device_id)
                - device_id: The device_id if present (for site filtering)

        Raises:
            ValueError: If the cursor format is invalid or token is expired
        """
        cursor_str = StatelessCursorUtils.retrieve_cursor(token)

        parts = cursor_str.split("|")
        if len(parts) < 2:
            raise ValueError(
                "Invalid cursor format: expected at least timestamp and filter value"
            )

        result = {"timestamp": parts[0], "filter_value": parts[1]}

        if len(parts) >= 3:
            result["device_id"] = parts[2]

        return result

    @staticmethod
    def create_cursor(
        timestamp: str, filter_value: str, device_id: Optional[str] = None
    ) -> str:
        """
        Creates a cursor string from its component parts and encodes it.

        Args:
            timestamp (str): The timestamp value
            filter_value (str): The filter value (e.g., site_id or device_id)
            device_id (str, optional): The device_id if needed (for site filtering)

        Returns:
            str: A token that can be used to retrieve the cursor
        """
        cursor = f"{timestamp}|{filter_value}"
        if device_id:
            cursor += f"|{device_id}"

        return StatelessCursorUtils.encode_cursor(cursor)

    @staticmethod
    def validate_cursor(token: str) -> bool:
        """
        Validates if a cursor token is valid and not expired.

        Args:
            token (str): The cursor token to validate

        Returns:
            bool: True if the cursor is valid, False otherwise
        """
        try:
            StatelessCursorUtils.retrieve_cursor(token)
            return True
        except ValueError:
            return False


# Default CursorUtils to use Stateless for production consistency
CursorUtils = StatelessCursorUtils
