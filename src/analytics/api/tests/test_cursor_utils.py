import pytest
from unittest.mock import patch, MagicMock
import uuid
import json

from api.utils.cursor_utils import CursorUtils


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


class TestCursorUtils:
    """Tests for the CursorUtils class."""

    @patch("api.utils.cursor_utils.uuid")
    def test_create_cursor_minimal(self, mock_uuid):
        """Test creating a cursor with minimal parameters."""
        # Set a fixed UUID for reliable testing
        mock_uuid.uuid4.return_value = uuid.UUID("00000000-0000-0000-0000-000000000000")

        with patch("api.utils.cursor_utils.cache") as mock_cache:
            mock_cache.set = MagicMock(return_value=True)

            cursor = CursorUtils.create_cursor("2025-01-01 00:00:00Z", "device1")

            assert cursor == "00000000-0000-0000-0000-000000000000"
            mock_cache.set.assert_called_once_with(
                "api:cursor:00000000-0000-0000-0000-000000000000",
                "2025-01-01 00:00:00Z|device1",
                timeout=CursorUtils.CURSOR_EXPIRATION,
            )

    @patch("api.utils.cursor_utils.uuid")
    def test_create_cursor_with_site_id(self, mock_uuid):
        """Test creating a cursor with timestamp, site_id, and device_id."""
        # Set a fixed UUID for reliable testing
        mock_uuid.uuid4.return_value = uuid.UUID("00000000-0000-0000-0000-000000000000")

        with patch("api.utils.cursor_utils.cache") as mock_cache:
            mock_cache.set = MagicMock(return_value=True)

            cursor = CursorUtils.create_cursor(
                "2025-01-01 00:00:00Z", "site1", "device1"
            )

            assert cursor == "00000000-0000-0000-0000-000000000000"
            mock_cache.set.assert_called_once_with(
                "api:cursor:00000000-0000-0000-0000-000000000000",
                "2025-01-01 00:00:00Z|site1|device1",
                timeout=CursorUtils.CURSOR_EXPIRATION,
            )

    def test_decode_cursor_basic(self, cursor_token, basic_cursor_string):
        """Test decoding a basic cursor."""
        with patch("api.utils.cursor_utils.cache") as mock_cache:
            mock_cache.get = MagicMock(return_value=basic_cursor_string)

            decoded = CursorUtils.retrieve_cursor(cursor_token)
            assert decoded == basic_cursor_string

    def test_decode_cursor_invalid(self):
        """Test decoding an invalid cursor."""
        with pytest.raises(ValueError):
            CursorUtils.retrieve_cursor("invalid-cursor")

    def test_validate_cursor_valid(self):
        """Test validating a valid cursor."""
        with patch("api.utils.cursor_utils.cache") as mock_cache:
            mock_cache.get = MagicMock(return_value=True)

            result = CursorUtils.validate_cursor("valid-cursor")

            assert result is True
            mock_cache.get.assert_called_once_with("api:cursor:valid-cursor")

    def test_validate_cursor_invalid(self):
        """Test validating an invalid cursor."""
        with patch("api.utils.cursor_utils.cache") as mock_cache:
            mock_cache.get = MagicMock(return_value=None)

            result = CursorUtils.validate_cursor("invalid-cursor")

            assert result is False
            mock_cache.get.assert_called_once_with("api:cursor:invalid-cursor")

    def test_parse_basic_cursor_valid(
        self, cursor_token, basic_cursor_string, parsed_basic_cursor_string
    ):
        """Test parsing a valid basic cursor."""
        with patch("api.utils.cursor_utils.cache") as mock_cache:
            mock_cache.get = MagicMock(return_value=basic_cursor_string)

            parsed = CursorUtils.parse_cursor(cursor_token)

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

            parsed = CursorUtils.parse_cursor(cursor_token)

            assert parsed == parsed_cursor_string_with_site_id
            mock_cache.get.assert_called_once()

    def test_parse_cursor_not_in_cache(self):
        """Test parsing a cursor that's not in the cache."""
        with patch("api.utils.cursor_utils.cache") as mock_cache:
            mock_cache.get = MagicMock(return_value=None)

            with pytest.raises(ValueError) as excinfo:
                CursorUtils.parse_cursor("invalid-cursor")

            assert "Invalid or expired cursor" in str(excinfo.value)
            mock_cache.get.assert_called_once()

    def test_create_cursor_redis_failure(self):
        """Test cursor creation and retrival when Redis fails."""
        with patch("api.utils.cursor_utils.cache") as mock_cache:
            mock_cache.set = MagicMock(side_effect=Exception("Redis connection error"))
            mock_cache.get = MagicMock(side_effect=Exception("Redis connection error"))

            with pytest.raises(Exception, match="Redis connection error"):
                CursorUtils.create_cursor("2025-01-01 00:00:00Z", "device1")

            with pytest.raises(Exception, match="Redis connection error"):
                CursorUtils.parse_cursor("some-token")

            mock_cache.set.assert_called_once()
            mock_cache.get.assert_called_once()
