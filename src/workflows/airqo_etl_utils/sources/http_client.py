import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from typing import Any, Dict, Optional


class HttpClient:
    """Thin, retry-backed HTTP client used by all data-source adapters.

    All methods accept an optional ``headers`` dict so callers (e.g. ``DataApi``)
    can inject pre-built auth headers without this class needing to know about
    integration configs or network-specific auth schemes.
    """

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
            allowed_methods=["GET", "POST", "PUT"],
        )
        adapter = HTTPAdapter(max_retries=retry)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        self.timeout = timeout

    def get_json(
        self,
        url: str,
        params: Optional[Dict] = None,
        headers: Optional[Dict] = None,
    ) -> Any:
        """Perform a GET request and return parsed JSON.

        Args:
            url (str): Fully qualified URL to request.
            params (Optional[Dict]): Query parameters appended to the request URL.
            headers (Optional[Dict]): Optional request headers (e.g. auth tokens).

        Returns:
            Any: Parsed JSON payload from the response.

        Raises:
            requests.exceptions.RequestException: For networking-level errors.
            requests.exceptions.HTTPError: If the server returned a 4xx/5xx status.
            ValueError: If the response body cannot be decoded as JSON.
        """
        resp = self.session.get(
            url, params=params, headers=headers, timeout=self.timeout
        )
        resp.raise_for_status()
        return resp.json()

    def post(
        self,
        url: str,
        json: Optional[Any] = None,
        params: Optional[Dict] = None,
        headers: Optional[Dict] = None,
    ) -> Any:
        """Perform a POST request with an optional JSON body and return parsed JSON.

        ``requests`` handles JSON serialisation and sets ``Content-Type:
        application/json`` automatically when ``json`` is provided.

        Args:
            url (str): Fully qualified URL to request.
            json (Optional[Any]): Payload to serialise as JSON and send as the request body.
            params (Optional[Dict]): Query parameters appended to the request URL.
            headers (Optional[Dict]): Optional request headers (e.g. auth tokens).

        Returns:
            Any: Parsed JSON payload from the response.

        Raises:
            requests.exceptions.RequestException: For networking-level errors.
            requests.exceptions.HTTPError: If the server returned a 4xx/5xx status.
            ValueError: If the response body cannot be decoded as JSON.
        """
        resp = self.session.post(
            url, json=json, params=params, headers=headers, timeout=self.timeout
        )
        resp.raise_for_status()
        return resp.json()

    def put(
        self,
        url: str,
        json: Optional[Any] = None,
        params: Optional[Dict] = None,
        headers: Optional[Dict] = None,
    ) -> Any:
        """Perform a PUT request with an optional JSON body and return parsed JSON.

        ``requests`` handles JSON serialisation and sets ``Content-Type:
        application/json`` automatically when ``json`` is provided.

        Args:
            url (str): Fully qualified URL to request.
            json (Optional[Any]): Payload to serialise as JSON and send as the request body.
            params (Optional[Dict]): Query parameters appended to the request URL.
            headers (Optional[Dict]): Optional request headers (e.g. auth tokens).

        Returns:
            Any: Parsed JSON payload from the response.

        Raises:
            requests.exceptions.RequestException: For networking-level errors.
            requests.exceptions.HTTPError: If the server returned a 4xx/5xx status.
            ValueError: If the response body cannot be decoded as JSON.
        """
        resp = self.session.put(
            url, json=json, params=params, headers=headers, timeout=self.timeout
        )
        resp.raise_for_status()
        return resp.json()

    def download_file(
        self,
        url: str,
        params: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        timeout: Optional[int] = None,
    ) -> requests.Response:
        """Perform a GET request and return the raw response for file/binary content.

        The response is intentionally not decoded — pass it directly to
        ``Utils.parse_api_response`` or read ``response.content`` to handle
        the bytes yourself.

        Args:
            url (str): Fully qualified URL to request.
            params (Optional[Dict]): Query parameters appended to the request URL.
            headers (Optional[Dict]): Optional request headers (e.g. auth tokens).
            timeout (Optional[int]): Override the default timeout (useful for large files).

        Returns:
            requests.Response: The raw HTTP response.

        Raises:
            requests.exceptions.RequestException: For networking-level errors.
            requests.exceptions.HTTPError: If the server returned a 4xx/5xx status.
        """
        resp = self.session.get(
            url,
            params=params,
            headers=headers,
            timeout=timeout or self.timeout,
        )
        resp.raise_for_status()
        return resp
