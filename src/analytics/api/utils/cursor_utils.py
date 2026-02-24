import uuid
import base64
import time
from typing import Optional, Tuple, Dict, Any
from main import cache
import redis
import logging

logger = logging.getLogger(__name__)

try:
    RedisConnectionError = redis.ConnectionError
except ImportError:
    RedisConnectionError = ConnectionError


class RedisCursorUtils:
    """
    Utility class for handling pagination cursors in the API using Redis.
    Provides methods for encoding, decoding, and extracting information from cursors.
    """

    # Cursor expiration time in seconds (0.1 hours)
    CURSOR_EXPIRATION = int(0.1 * 60 * 60)  # Ensure this is an integer (6 minutes)

    CURSOR_KEY_PREFIX = "api:cursor:"

    @staticmethod
    def _set_cache_expiration(cursor_key: str) -> None:
        """
        Helper method to set cache expiration if supported by the cache backend.
        """
        if hasattr(cache, "expire"):
            cache.expire(cursor_key, RedisCursorUtils.CURSOR_EXPIRATION)

    @staticmethod
    def encode_cursor(cursor_str: str) -> str:
        """
        Stores a cursor string in Redis with a unique token.

        Args:
            cursor_str(str): The raw cursor string to store

        Returns:
            str: Unique cursor token for API response
        """
        cursor_token = str(uuid.uuid4())

        cursor_key = f"{RedisCursorUtils.CURSOR_KEY_PREFIX}{cursor_token}"
        try:
            cache.set(
                cursor_key, cursor_str, timeout=RedisCursorUtils.CURSOR_EXPIRATION
            )
        except TypeError:
            # Fallback if 'timeout' is not supported
            cache.set(cursor_key, cursor_str)
            RedisCursorUtils._set_cache_expiration(cursor_key)
        except RedisConnectionError:
            logger.exception("Failed to store cursor in Redis")
            # TODO: Figure out how to handle Redis connection errors | may be retry
            pass
        return cursor_token

    @staticmethod
    def retrieve_cursor(token: str) -> str:
        """
        Retrieves a cursor from Redis using its token and refreshes its expiration time.

        This method fetches the stored cursor string associated with the provided token,
        extends its expiration time to prevent premature invalidation during active use,
        and returns the cursor string for further processing.

        Args:
            token(str): The unique cursor token received from a previous API response

        Returns:
            str: The retrieved cursor string containing pagination metadata

        Raises:
            ValueError: If the token is invalid, doesn't exist in cache, or has already expired
        """
        cursor_key = f"{RedisCursorUtils.CURSOR_KEY_PREFIX}{token}"
        cursor_str: Optional[str] = None
        try:
            # Attempt to get the cursor string from cache
            cursor_str = cache.get(cursor_key)
        except RedisConnectionError:
            logger.exception("Failed to retrieve cursor from Redis")
            # TODO: Figure out how to handle Redis connection errors | may be retry
            pass

        if not cursor_str:
            raise ValueError("Invalid or expired cursor token")

        # Reset the expiration time when the cursor is accessed
        try:
            cache.set(
                cursor_key, cursor_str, timeout=RedisCursorUtils.CURSOR_EXPIRATION
            )
        except TypeError:
            cache.set(cursor_key, cursor_str)
            RedisCursorUtils._set_cache_expiration(cursor_key)
        except RedisConnectionError:
            logger.exception("Failed to refresh cursor expiration in Redis")

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
        cursor_str: Optional[str] = RedisCursorUtils.retrieve_cursor(token)
        if not cursor_str:
            raise ValueError("Invalid or expired cursor token")

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

        return RedisCursorUtils.encode_cursor(cursor)

    @staticmethod
    def validate_cursor(token: str) -> bool:
        """
        Validates if a cursor token exists in Redis.

        Args:
            token (str): The cursor token to validate

        Returns:
            bool: True if the cursor is valid, False otherwise
        """
        cursor_key = f"{RedisCursorUtils.CURSOR_KEY_PREFIX}{token}"

        try:
            return cache.get(cursor_key) is not None
        except RedisConnectionError:
            logger.exception("Failed to validate cursor in Redis")
            return False


class StatelessCursorUtils:
    """
    Utility class for handling pagination cursors in the API using stateless tokens.
    Provides methods for encoding, decoding, and extracting information from cursors.

    Note: This implementation uses stateless base64 encoded tokens with embedded
    expiration to ensure consistency across multiple API replicas.
    """

    # Cursor expiration time in seconds (0.1 hours)
    CURSOR_EXPIRATION = int(0.1 * 60 * 60)

    @staticmethod
    def encode_cursor(cursor_str: str) -> str:
        """
        Encodes a cursor string into a stateless token with an embedded expiration.

        Args:
            cursor_str(str): The raw cursor string to store

        Returns:
            str: Stateless cursor token for API response
        """
        try:
            # Embed expiration timestamp in the token
            expiration = int(time.time()) + StatelessCursorUtils.CURSOR_EXPIRATION
            payload = f"{cursor_str}|{expiration}"
            # Use URL-safe base64 encoding
            return (
                base64.urlsafe_b64encode(payload.encode()).decode("utf-8").rstrip("=")
            )
        except Exception as e:
            logger.error(f"Failed to encode cursor: {e}")
            # Fallback to a random uuid if encoding fails
            return str(uuid.uuid4())

    @staticmethod
    def retrieve_cursor(token: str) -> str:
        """
        Decodes a stateless cursor token and validates its expiration.

        Args:
            token(str): The cursor token received from a previous API response

        Returns:
            str: The retrieved cursor string containing pagination metadata

        Raises:
            ValueError: If the token is invalid or has expired
        """
        try:
            # Add back padding if it was stripped
            padding = len(token) % 4
            if padding:
                token += "=" * (4 - padding)

            decoded = base64.urlsafe_b64decode(token.encode()).decode("utf-8")
            parts = decoded.rsplit("|", 1)

            if len(parts) != 2:
                raise ValueError("Invalid cursor format")

            cursor_raw, expiration_str = parts[0], parts[1]
            if int(time.time()) > int(expiration_str):
                raise ValueError("Cursor has expired")

            return cursor_raw
        except ValueError as e:
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
