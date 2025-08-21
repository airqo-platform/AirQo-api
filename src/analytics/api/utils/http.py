from config import BaseConfig as Config
import simplejson
import urllib3
from urllib3.util.retry import Retry
from urllib.parse import urlencode
import logging
from typing import Dict, Any, Optional


logger = logging.getLogger(__name__)


class AirQoRequests:
    """A class to handle HTTP requests with retry logic and status code checks."""

    class Status:
        """HTTP status codes and helper methods to categorize them."""

        # Informational
        HTTP_100_CONTINUE = 100
        HTTP_101_SWITCHING_PROTOCOLS = 101

        # Successful
        HTTP_200_OK = 200
        HTTP_201_CREATED = 201
        HTTP_202_ACCEPTED = 202
        HTTP_203_NON_AUTHORITATIVE_INFORMATION = 203
        HTTP_204_NO_CONTENT = 204
        HTTP_205_RESET_CONTENT = 205
        HTTP_206_PARTIAL_CONTENT = 206

        # Redirection
        HTTP_300_MULTIPLE_CHOICES = 300
        HTTP_301_MOVED_PERMANENTLY = 301
        HTTP_302_FOUND = 302
        HTTP_303_SEE_OTHER = 303
        HTTP_304_NOT_MODIFIED = 304
        HTTP_305_USE_PROXY = 305
        HTTP_306_RESERVED = 306
        HTTP_307_TEMPORARY_REDIRECT = 307

        # Client Error
        HTTP_400_BAD_REQUEST = 400
        HTTP_401_UNAUTHORIZED = 401
        HTTP_402_PAYMENT_REQUIRED = 402
        HTTP_403_FORBIDDEN = 403
        HTTP_404_NOT_FOUND = 404
        HTTP_405_METHOD_NOT_ALLOWED = 405
        HTTP_406_NOT_ACCEPTABLE = 406
        HTTP_407_PROXY_AUTHENTICATION_REQUIRED = 407
        HTTP_408_REQUEST_TIMEOUT = 408
        HTTP_409_CONFLICT = 409
        HTTP_410_GONE = 410
        HTTP_411_LENGTH_REQUIRED = 411
        HTTP_412_PRECONDITION_FAILED = 412
        HTTP_413_REQUEST_ENTITY_TOO_LARGE = 413
        HTTP_414_REQUEST_URI_TOO_LONG = 414
        HTTP_415_UNSUPPORTED_MEDIA_TYPE = 415
        HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE = 416
        HTTP_417_EXPECTATION_FAILED = 417
        HTTP_428_PRECONDITION_REQUIRED = 428
        HTTP_429_TOO_MANY_REQUESTS = 429
        HTTP_431_REQUEST_HEADER_FIELDS_TOO_LARGE = 431

        # Server Error
        HTTP_500_INTERNAL_SERVER_ERROR = 500
        HTTP_501_NOT_IMPLEMENTED = 501
        HTTP_502_BAD_GATEWAY = 502
        HTTP_503_SERVICE_UNAVAILABLE = 503
        HTTP_504_GATEWAY_TIMEOUT = 504
        HTTP_505_HTTP_VERSION_NOT_SUPPORTED = 505
        HTTP_511_NETWORK_AUTHENTICATION_REQUIRED = 511

        @classmethod
        def is_informational(cls, status_code):
            """Check if the status code is informational (1xx)."""
            return 100 <= status_code < 200

        @classmethod
        def is_success(cls, status_code):
            """Check if the status code indicates success (2xx)."""
            return 200 <= status_code < 300

        @classmethod
        def is_redirect(cls, status_code):
            """Check if the status code is for redirection (3xx)."""
            return 300 <= status_code < 400

        @classmethod
        def is_client_error(cls, status_code):
            """Check if the status code indicates a client error (4xx)."""
            return 400 <= status_code < 500

        @classmethod
        def is_server_error(cls, status_code):
            """Check if the status code indicates a server error (5xx)."""
            return 500 <= status_code < 600

    def __init__(self):
        """
        Initialize the AirQoRequests instance.
        """
        self.AIRQO_API_TOKEN = Config.AIRQO_API_TOKEN
        self.BASE_URL_V2 = Config.AIRQO_API_BASE_URL

    def request(self, endpoint, params=None, body=None, method="get", base_url=None):
        """
        Execute an HTTP request and return the response.

        Args:
            endpoint (str): API endpoint to send the request to.
            params (dict, optional): Parameters for the API request.
            body (dict, optional): Payload for POST/PUT requests.
            method (str): HTTP method (e.g., "get", "post").
            base_url (str, optional): Custom base URL for the request.

        Returns:
            dict: Parsed JSON response if successful; otherwise, an error message.
        """
        if base_url is None:
            base_url = self.BASE_URL_V2

        headers: Dict[str, Any] = {}
        if params is None:
            params = {}
        params.update({"token": self.AIRQO_API_TOKEN})

        retry_strategy = Retry(
            total=5,
            backoff_factor=5,
        )

        http = urllib3.PoolManager(retries=retry_strategy)
        url = f"{base_url}/{endpoint}"

        try:
            if method.lower() in ["put", "post"]:
                headers["Content-Type"] = "application/json"
                encoded_args = urlencode(params)
                url = f"{url}?{encoded_args}"
                response = http.request(
                    method.upper(),
                    url,
                    headers=headers,
                    body=simplejson.dumps(body, ignore_nan=True) if body else None,
                )
            elif method.lower() == "get":
                response = http.request(
                    method.upper(), url, fields=params, headers=headers
                )
            else:
                logger.exception("Method not supported")
                return None

            if response.status in {
                self.Status.HTTP_200_OK,
                self.Status.HTTP_201_CREATED,
            }:
                return self.create_response(
                    "Success fully returned request data",
                    data=simplejson.loads(response.data),
                    success=True,
                )
            else:
                return self.create_response(f"Error: {response.data}", success=False)

        except urllib3.exceptions.HTTPError as ex:
            logger.exception(f"HTTPError: {ex}")
            return self.create_response(f"HTTPError: {ex}", success=False)

    @staticmethod
    def create_response(
        message, data=None, success=True, metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate a standardized response dictionary.

        Args:
            message (str): Message describing the response.
            data (dict, optional): Data payload of the response.
            success (bool): Whether the response indicates success.

        Returns:
            dict: Standardized response dictionary.
        """
        response = {
            "status": "success" if success else "error",
            "message": message,
            "data": data,
            "metadata": metadata,
        }
        return response
