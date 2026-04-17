"""Network-specific HTTP authentication helpers.

Usage::

    from airqo_etl_utils.utils.auth.headers import AuthHeaderBuilder
    from airqo_etl_utils.constants import DeviceNetwork

    headers, params = AuthHeaderBuilder.build(
        network=DeviceNetwork.AIRQO,
        integration=integration_config,
        headers={},
        params=request_params,
    )
"""

import urllib3
from typing import Any, Dict, Optional, Tuple

from airqo_etl_utils.constants import DeviceNetwork


class AuthHeaderBuilder:
    """Builds network-specific authentication headers and query parameters.

    Each supported network has its own authentication scheme.  Call
    :meth:`build` as the single entry-point; it dispatches to the correct
    private handler based on the ``network`` argument.

    Supported networks
    ------------------
    * ``DeviceNetwork.AIRQO``  — API-key/token auth injected into headers and
      query parameters from ``integration["auth"]`` / ``integration["secret"]``.
    * ``DeviceNetwork.TAHMO``  — HTTP Basic Auth derived from
      ``integration["auth"]["api_key"]`` and ``integration["secret"]["secret"]``.

    Integration config shape (expected keys per network)
    ------------------------------------------------------
    AirQo::

        {
            "auth":   {"Authorization": "..."},   # merged into headers
            "secret": {"token": "..."},            # appended as query param
        }

    TAHMO::

        {
            "auth":   {"api_key": "..."},
            "secret": {"secret": "..."},
        }
    """

    @staticmethod
    def build(
        network: DeviceNetwork,
        integration: Dict[str, Any],
        headers: Dict[str, Any],
        params: Optional[Dict[str, Any]] = None,
    ) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
        """Return ``(headers, params)`` updated with auth credentials for ``network``.

        If the integration config carries no ``"auth"`` key, or the network is
        not yet supported, ``(headers, params)`` are returned unchanged so
        callers always receive a valid tuple.

        Args:
            network (DeviceNetwork): The target network whose auth scheme to apply.
            integration (Dict[str, Any]): Integration configuration dict loaded
                from ``configuration.INTEGRATION_DETAILS[network.str]``.
                Must contain at least an ``"auth"`` key for auth to be applied.
            headers (Dict[str, Any]): Existing headers dict to update in-place.
                Pass an empty dict ``{}`` if no prior headers exist.
            params (Optional[Dict[str, Any]]): Existing query-parameter dict to
                update in-place.  Some networks (e.g. AirQo) append a token here.
                Pass ``None`` or omit when issuing requests without query params.

        Returns:
            Tuple[Dict[str, Any], Optional[Dict[str, Any]]]:
                ``(headers, params)`` — both potentially mutated with auth data.
                ``params`` may be ``None`` if the network's scheme does not use
                query-parameter auth (e.g. TAHMO uses headers-only Basic Auth).
        """
        if not integration.get("auth"):
            return headers, params

        if network == DeviceNetwork.AIRQO:
            return AuthHeaderBuilder._apply_airqo_auth(
                integration, headers, params or {}
            )
        if network == DeviceNetwork.TAHMO:
            return AuthHeaderBuilder._apply_tahmo_auth(integration, headers)

        return headers, params

    # ------------------------------------------------------------------
    # Private per-network handlers
    # ------------------------------------------------------------------

    @staticmethod
    def _apply_airqo_auth(
        integration: Dict[str, Any],
        headers: Dict[str, Any],
        params: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Apply AirQo authentication to ``headers`` and ``params``.

        Merges all key-value pairs from ``integration["auth"]`` into ``headers``
        (typically an ``Authorization`` bearer token), then appends the API
        token from ``integration["secret"]["token"]`` as a ``"token"`` query
        parameter when present.

        Args:
            integration (Dict[str, Any]): AirQo integration config.
            headers (Dict[str, Any]): Request headers to update.
            params (Dict[str, Any]): Query parameters to update.

        Returns:
            Tuple[Dict[str, Any], Dict[str, Any]]: Updated ``(headers, params)``.
        """
        headers.update(integration.get("auth", {}))
        token = integration.get("secret", {}).get("token")
        if token:
            params["token"] = token
        return headers, params

    @staticmethod
    def _apply_tahmo_auth(
        integration: Dict[str, Any],
        headers: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], None]:
        """Apply TAHMO HTTP Basic Auth to ``headers``.

        Constructs a ``Basic`` ``Authorization`` header from
        ``integration["auth"]["api_key"]`` and ``integration["secret"]["secret"]``
        using :func:`urllib3.make_headers`.  If either credential is missing
        the headers are returned unchanged.

        Args:
            integration (Dict[str, Any]): TAHMO integration config.
            headers (Dict[str, Any]): Request headers to update.

        Returns:
            Tuple[Dict[str, Any], None]: Updated ``headers`` and ``None`` (TAHMO
            does not use query-parameter auth).
        """
        api_key = integration.get("auth", {}).get("api_key")
        secret = integration.get("secret", {}).get("secret")
        if api_key and secret:
            headers.update(urllib3.make_headers(basic_auth=f"{api_key}:{secret}"))
        return headers, None
