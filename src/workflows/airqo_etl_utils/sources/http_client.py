import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from typing import Any, Dict, Optional


class HttpClient:
    def __init__(
        self,
        retries: int = 3,
        backoff_factor: float = 0.3,
        status_forcelist: tuple = (500, 502, 504),
        timeout: int = 10,
    ) -> None:
        self.session = requests.Session()
        retry = Retry(
            total=retries,
            backoff_factor=backoff_factor,
            status_forcelist=status_forcelist,
            allowed_methods=["GET", "POST"],
        )
        adapter = HTTPAdapter(max_retries=retry)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        self.timeout = timeout

    def get_json(
        self, url: str, params: Optional[Dict] = None, headers: Optional[Dict] = None
    ) -> Any:
        """Perform a GET request and return parsed JSON.

        Args:
            url (str): Fully qualified URL to request.
            params (Optional[Dict]): Query parameters to include in the request.
            headers (Optional[Dict]): Optional request headers.

        Returns:
            Any: Parsed JSON payload from the response.

        Raises:
            requests.exceptions.RequestException: For networking-level errors.
            ValueError: If the response body cannot be decoded as JSON.
        """
        resp = self.session.get(
            url, params=params, headers=headers, timeout=self.timeout
        )
        resp.raise_for_status()
        return resp.json()
