import base64
import uuid
from typing import Optional, Tuple, Dict, Any
from main import cache
import json
import time


class CursorUtils:
    """
    Utility class for handling pagination cursors in the API.
    Provides methods for encoding, decoding, and extracting information from cursors.
    """

    # Cursor expiration time in seconds (0.1 hours)
    CURSOR_EXPIRATION = int(0.1 * 60 * 60)  # Ensure this is an integer (6 minutes)

    CURSOR_KEY_PREFIX = "api:cursor:"

    @staticmethod
    def encode_cursor(cursor_str: str) -> str:
        """
        Base64 encodes a cursor string and stores it in Redis with a unique token.

        Args:
            cursor_str(str): The raw cursor string to encode

        Returns:
            str: Unique cursor token for API response
        """
        token = str(uuid.uuid4())

        cursor_key = f"{CursorUtils.CURSOR_KEY_PREFIX}{token}"
        cache.set(cursor_key, cursor_str, timeout=CursorUtils.CURSOR_EXPIRATION)
        return token

    @staticmethod
    def decode_cursor(token: str) -> str:
        """
        Retrieves and decodes a cursor from Redis using its token.

        Args:
            token (str): The cursor token from the API request

        Returns:
            str: Decoded cursor string

        Raises:
            ValueError: If the token is invalid or expired
        """
        cursor_key = f"{CursorUtils.CURSOR_KEY_PREFIX}{token}"
        cursor_str = cache.get(cursor_key)

        if not cursor_str:
            raise ValueError("Invalid or expired cursor token")

        # Reset the expiration time when the cursor is accessed
        cache.set(cursor_key, cursor_str, timeout=CursorUtils.CURSOR_EXPIRATION)

        return cursor_str

    @staticmethod
    def parse_cursor(token: str) -> Dict[str, Any]:
        """
        Retrieves a cursor from Redis and parses it into its component parts.

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
        cursor_str = CursorUtils.decode_cursor(token)

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
        Creates a cursor string from its component parts and stores it in Redis.

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

        return CursorUtils.encode_cursor(cursor)

    @staticmethod
    def validate_cursor(token: str) -> bool:
        """
        Validates if a cursor token exists in Redis.

        Args:
            token (str): The cursor token to validate

        Returns:
            bool: True if the cursor is valid, False otherwise
        """
        cursor_key = f"{CursorUtils.CURSOR_KEY_PREFIX}{token}"
        return cache.get(cursor_key) is not None
