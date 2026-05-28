import requests
from requests.adapters import HTTPAdapter
from typing import Any, Dict, Optional
from urllib3.util.retry import Retry


class HttpClient:
    """Retry-backed HTTP client used across the airqo_etl_utils package.

    Wraps a :class:`requests.Session` with automatic retry logic and connection
    pooling.  All methods accept optional ``headers`` and ``params`` dicts so
    callers can inject auth or query parameters without this class needing to
    know about integration configs.

    The ``post`` and ``put`` methods support two mutually exclusive body modes:

    * ``json`` — pass a Python object; ``requests`` will serialise it with the
      standard library encoder and set ``Content-Type: application/json``.
    * ``data`` — pass a pre-encoded string (e.g. from ``simplejson.dumps`` with
      ``ignore_nan=True``) when custom serialisation is required.  The caller
      is responsible for setting ``Content-Type`` via ``headers`` when needed.
    """

    def __init__(
        self,
        retries: int = 3,
        backoff_factor: float = 0.3,
        status_forcelist: tuple = (500, 502, 504),
        timeout: int = 10,
        pool_connections: int = 10,
        pool_maxsize: int = 10,
    ) -> None:
        self.session = requests.Session()
        retry = Retry(
            total=retries,
            backoff_factor=backoff_factor,
            status_forcelist=status_forcelist,
            # POST and PUT are excluded: retrying non-idempotent writes on 5xx can
            # cause duplicate records (devices, events). Only safe read/delete methods
            # are retried automatically; callers own retry logic for writes.
            allowed_methods=["GET", "DELETE"],
        )
        adapter = HTTPAdapter(
            max_retries=retry,
            pool_connections=pool_connections,
            pool_maxsize=pool_maxsize,
        )
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
            url (str): Fully qualified URL.
            params (Optional[Dict]): Query parameters appended to the URL.
            headers (Optional[Dict]): Optional request headers.

        Returns:
            Any: Parsed JSON payload.

        Raises:
            requests.exceptions.HTTPError: If the server returned a 4xx/5xx status.
            requests.exceptions.RequestException: For networking-level errors.
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
        data: Optional[str] = None,
        params: Optional[Dict] = None,
        headers: Optional[Dict] = None,
    ) -> Any:
        """Perform a POST request and return parsed JSON.

        Args:
            url (str): Fully qualified URL.
            json (Optional[Any]): Payload serialised by ``requests`` (stdlib JSON encoder).
            data (Optional[str]): Pre-encoded body string; caller must set ``Content-Type``
                via ``headers`` if required.
            params (Optional[Dict]): Query parameters appended to the URL.
            headers (Optional[Dict]): Optional request headers.

        Returns:
            Any: Parsed JSON payload.

        Raises:
            requests.exceptions.HTTPError: If the server returned a 4xx/5xx status.
            requests.exceptions.RequestException: For networking-level errors.
            ValueError: If the response body cannot be decoded as JSON.
        """
        resp = self.session.post(
            url,
            json=json,
            data=data,
            params=params,
            headers=headers,
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return resp.json()

    def put(
        self,
        url: str,
        json: Optional[Any] = None,
        data: Optional[str] = None,
        params: Optional[Dict] = None,
        headers: Optional[Dict] = None,
    ) -> Any:
        """Perform a PUT request and return parsed JSON.

        Args:
            url (str): Fully qualified URL.
            json (Optional[Any]): Payload serialised by ``requests`` (stdlib JSON encoder).
            data (Optional[str]): Pre-encoded body string; caller must set ``Content-Type``
                via ``headers`` if required.
            params (Optional[Dict]): Query parameters appended to the URL.
            headers (Optional[Dict]): Optional request headers.

        Returns:
            Any: Parsed JSON payload.

        Raises:
            requests.exceptions.HTTPError: If the server returned a 4xx/5xx status.
            requests.exceptions.RequestException: For networking-level errors.
            ValueError: If the response body cannot be decoded as JSON.
        """
        resp = self.session.put(
            url,
            json=json,
            data=data,
            params=params,
            headers=headers,
            timeout=self.timeout,
        )
        resp.raise_for_status()
        return resp.json()

    def delete(
        self,
        url: str,
        params: Optional[Dict] = None,
        headers: Optional[Dict] = None,
    ) -> requests.Response:
        """Perform a DELETE request and return the raw response.

        Returns the raw response rather than parsed JSON because DELETE endpoints
        commonly return 204 No Content with an empty body.

        Args:
            url (str): Fully qualified URL.
            params (Optional[Dict]): Query parameters appended to the URL.
            headers (Optional[Dict]): Optional request headers.

        Returns:
            requests.Response: The raw HTTP response (check ``.status_code`` as needed).

        Raises:
            requests.exceptions.HTTPError: If the server returned a 4xx/5xx status.
            requests.exceptions.RequestException: For networking-level errors.
        """
        resp = self.session.delete(
            url, params=params, headers=headers, timeout=self.timeout
        )
        resp.raise_for_status()
        return resp

    def download_file(
        self,
        url: str,
        params: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        timeout: Optional[int] = None,
    ) -> requests.Response:
        """Perform a GET request and return the raw response for binary content.

        The response is intentionally not decoded — read ``response.content``
        or pass it to ``Utils.parse_api_response`` to handle the bytes.

        Args:
            url (str): Fully qualified URL.
            params (Optional[Dict]): Query parameters appended to the URL.
            headers (Optional[Dict]): Optional request headers.
            timeout (Optional[int]): Override the default timeout (useful for large files).

        Returns:
            requests.Response: The raw HTTP response.

        Raises:
            requests.exceptions.HTTPError: If the server returned a 4xx/5xx status.
            requests.exceptions.RequestException: For networking-level errors.
        """
        resp = self.session.get(
            url, params=params, headers=headers, timeout=timeout or self.timeout
        )
        resp.raise_for_status()
        return resp
