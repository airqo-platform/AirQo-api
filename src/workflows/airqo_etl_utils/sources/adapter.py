from abc import ABC, abstractmethod
from typing import List, Dict, Tuple, Optional, Any

from ..utils import Result


class DataSourceAdapter(ABC):
    @abstractmethod
    def fetch(
        self,
        device: Dict[str, Any],
        dates: List[Tuple[str, str]],
        resolution: Any = None,
    ) -> Result:
        """Fetch time-series data for a device across date ranges.

        Args:
            device (Dict[str, Any]): Device metadata dictionary. Expected keys include:
                - `device_number` (int) or `serial_number` (str)
                - `api_code` (str) or other provider-specific identifiers
            dates (List[Tuple[str, str]]): List of (start_iso, end_iso) tuples defining ranges to fetch.
            resolution (Any): Optional resolution hint (provider-specific).

        Returns:
            Result: A `Result` object whose `data` is a dict with keys:
                - `records`: List[Dict[str, Any]] (the series records)
                - `meta`: Dict[str, Any] (optional provider metadata)
            The `error` field is an optional error message string.

        Raises:
            Exception: Implementations may raise provider-specific exceptions which callers
            should handle when invoking adapters.
        """
        raise NotImplementedError()
