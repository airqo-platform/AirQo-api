import pytest
from unittest.mock import patch, MagicMock
import uuid
import json
import base64
import time

from api.utils.cursor_utils import CursorUtils, RedisCursorUtils, StatelessCursorUtils


@pytest.fixture
def cursor_token():
    """Return a sample cursor token."""
    return "test-uuid"


@pytest.fixture
def basic_cursor_string():
    """Return a basic cursor string."""
    return "2025-01-01 00:00:00Z|device1"


@pytest.fixture
def cursor_string_with_site_id():
    """Return a cursor string with site_id as filter value."""
    return "2025-01-01 00:00:00Z|site1|device1"


@pytest.fixture
def parsed_basic_cursor_string():
    """Return a parsed cursor string."""
    return {"timestamp": "2025-01-01 00:00:00Z", "filter_value": "device1"}


@pytest.fixture
def parsed_cursor_string_with_site_id():
    """Return a parsed cursor string."""
    return {
        "timestamp": "2025-01-01 00:00:00Z",
        "filter_value": "site1",
        "device_id": "device1",
    }


class TestRedisCursorUtils:
    """Tests for the RedisCursorUtils class."""

    @patch("api.utils.cursor_utils.uuid")
    def test_create_cursor_minimal(self, mock_uuid):
        """Test creating a cursor with minimal parameters."""
        # Set a fixed UUID for reliable testing
        mock_uuid.uuid4.return_value = uuid.UUID("00000000-0000-0000-0000-000000000000")

        with patch("api.utils.cursor_utils.cache") as mock_cache:
            mock_cache.set = MagicMock(return_value=True)

            cursor = RedisCursorUtils.create_cursor("2025-01-01 00:00:00Z", "device1")

            assert cursor == "00000000-0000-0000-0000-000000000000"
            mock_cache.set.assert_called_once_with(
                "api:cursor:00000000-0000-0000-0000-000000000000",
                "2025-01-01 00:00:00Z|device1",
                timeout=RedisCursorUtils.CURSOR_EXPIRATION,
            )

    @patch("api.utils.cursor_utils.uuid")
    def test_create_cursor_with_site_id(self, mock_uuid):
        """Test creating a cursor with timestamp, site_id, and device_id."""
        # Set a fixed UUID for reliable testing
        mock_uuid.uuid4.return_value = uuid.UUID("00000000-0000-0000-0000-000000000000")

        with patch("api.utils.cursor_utils.cache") as mock_cache:
            mock_cache.set = MagicMock(return_value=True)

            cursor = RedisCursorUtils.create_cursor(
                "2025-01-01 00:00:00Z", "site1", "device1"
            )

            assert cursor == "00000000-0000-0000-0000-000000000000"
            mock_cache.set.assert_called_once_with(
                "api:cursor:00000000-0000-0000-0000-000000000000",
                "2025-01-01 00:00:00Z|site1|device1",
                timeout=RedisCursorUtils.CURSOR_EXPIRATION,
            )

    def test_decode_cursor_basic(self, cursor_token, basic_cursor_string):
        """Test decoding a basic cursor."""
        with patch("api.utils.cursor_utils.cache") as mock_cache:
            mock_cache.get = MagicMock(return_value=basic_cursor_string)

            decoded = RedisCursorUtils.retrieve_cursor(cursor_token)
            assert decoded == basic_cursor_string

    def test_decode_cursor_invalid(self):
        """Test decoding an invalid cursor."""
        with pytest.raises(ValueError):
            RedisCursorUtils.retrieve_cursor("invalid-cursor")

    def test_validate_cursor_valid(self):
        """Test validating a valid cursor."""
        with patch("api.utils.cursor_utils.cache") as mock_cache:
            mock_cache.get = MagicMock(return_value=True)

            result = RedisCursorUtils.validate_cursor("valid-cursor")

            assert result is True
            mock_cache.get.assert_called_once_with("api:cursor:valid-cursor")

    def test_validate_cursor_invalid(self):
        """Test validating an invalid cursor."""
        with patch("api.utils.cursor_utils.cache") as mock_cache:
            mock_cache.get = MagicMock(return_value=None)

            result = RedisCursorUtils.validate_cursor("invalid-cursor")

            assert result is False
            mock_cache.get.assert_called_once_with("api:cursor:invalid-cursor")

    def test_parse_basic_cursor_valid(
        self, cursor_token, basic_cursor_string, parsed_basic_cursor_string
    ):
        """Test parsing a valid basic cursor."""
        with patch("api.utils.cursor_utils.cache") as mock_cache:
            mock_cache.get = MagicMock(return_value=basic_cursor_string)

            parsed = RedisCursorUtils.parse_cursor(cursor_token)

            assert parsed == parsed_basic_cursor_string
            mock_cache.get.assert_called_once()

    def test_parse_cursor_with_site_id_valid(
        self,
        cursor_token,
        cursor_string_with_site_id,
        parsed_cursor_string_with_site_id,
    ):
        """Test parsing a valid cursor with site_id."""
        with patch("api.utils.cursor_utils.cache") as mock_cache:
            mock_cache.get = MagicMock(return_value=cursor_string_with_site_id)

            parsed = RedisCursorUtils.parse_cursor(cursor_token)

            assert parsed == parsed_cursor_string_with_site_id
            mock_cache.get.assert_called_once()

    def test_parse_cursor_not_in_cache(self):
        """Test parsing a cursor that's not in the cache."""
        with patch("api.utils.cursor_utils.cache") as mock_cache:
            mock_cache.get = MagicMock(return_value=None)

            with pytest.raises(ValueError) as excinfo:
                RedisCursorUtils.parse_cursor("invalid-cursor")

            assert "Invalid or expired cursor" in str(excinfo.value)
            mock_cache.get.assert_called_once()

    def test_create_cursor_redis_failure(self):
        """Test cursor creation and retrival when Redis fails."""
        with patch("api.utils.cursor_utils.cache") as mock_cache:
            mock_cache.set = MagicMock(side_effect=Exception("Redis connection error"))
            mock_cache.get = MagicMock(side_effect=Exception("Redis connection error"))

            with pytest.raises(Exception, match="Redis connection error"):
                RedisCursorUtils.create_cursor("2025-01-01 00:00:00Z", "device1")

            with pytest.raises(Exception, match="Redis connection error"):
                RedisCursorUtils.parse_cursor("some-token")

            mock_cache.set.assert_called_once()
            mock_cache.get.assert_called_once()


class TestStatelessCursorUtils:
    """Tests for the StatelessCursorUtils class."""

    def test_create_cursor_minimal(self):
        """Test creating a stateless cursor with minimal parameters."""
        cursor = StatelessCursorUtils.create_cursor("2025-01-01 00:00:00Z", "device1")

        # Result should be a base64 string
        assert isinstance(cursor, str)
        assert len(cursor) > 0

        # Decoding should return the original data and a future timestamp
        decoded = StatelessCursorUtils.retrieve_cursor(cursor)
        assert decoded == "2025-01-01 00:00:00Z|device1"

    def test_create_cursor_with_site_id(self):
        """Test creating a stateless cursor with site_id."""
        cursor = StatelessCursorUtils.create_cursor(
            "2025-01-01 00:00:00Z", "site1", "device1"
        )

        decoded = StatelessCursorUtils.retrieve_cursor(cursor)
        assert decoded == "2025-01-01 00:00:00Z|site1|device1"

    def test_validate_cursor_valid(self):
        """Test validating a valid stateless cursor."""
        token = StatelessCursorUtils.create_cursor("2025-01-01 00:00:00Z", "device1")
        assert StatelessCursorUtils.validate_cursor(token) is True

    def test_validate_cursor_expired(self):
        """Test validating an expired stateless cursor."""
        # Create a payload with an expired timestamp
        expired_time = int(time.time()) - 100
        payload = f"2025-01-01 00:00:00Z|device1|{expired_time}"
        expired_token = (
            base64.urlsafe_b64encode(payload.encode()).decode("utf-8").rstrip("=")
        )

        assert StatelessCursorUtils.validate_cursor(expired_token) is False
        with pytest.raises(ValueError, match="expired"):
            StatelessCursorUtils.retrieve_cursor(expired_token)

    def test_parse_cursor_valid(self):
        """Test parsing a stateless cursor."""
        token = StatelessCursorUtils.create_cursor(
            "2025-01-01 00:00:00Z", "site1", "device1"
        )
        parsed = StatelessCursorUtils.parse_cursor(token)

        assert parsed == {
            "timestamp": "2025-01-01 00:00:00Z",
            "filter_value": "site1",
            "device_id": "device1",
        }

    def test_retrieve_cursor_invalid_format(self):
        """Test retrieving a cursor with invalid format."""
        # Token not containing '|'
        invalid_token = base64.urlsafe_b64encode(b"invalid_data").decode("utf-8")

        with pytest.raises(ValueError, match="Invalid cursor format"):
            StatelessCursorUtils.retrieve_cursor(invalid_token)
