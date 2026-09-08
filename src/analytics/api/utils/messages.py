from datetime import datetime
from typing import Optional

NETWORK_REQUIRED_MSG = (
    "Please specify the organization name. Refer to the API documentation for details."
)
FILTER_MSG = "Specify exactly one of 'sites', 'device_ids', 'device_names', or 'grid_ids' in the request body."

RATE_LIMIT_ERROR = "You have exceeded your rate limit. Please wait before retrying."


def no_data_message(
    start: datetime, end: datetime, entity: Optional[str] = None
) -> str:
    """
    The one wording every endpoint uses when a query succeeds but matches
    nothing, so a client can treat "no data" the same way everywhere.

    An empty result is a success envelope (200, status="success", empty data)
    rather than an error: the request was valid, the period simply holds no
    measurements. It lives here rather than in the service layer because the
    report builder — which the service imports — needs the same sentence.
    """
    subject = f" for {entity}" if entity else ""
    return (
        f"No data available{subject} for the selected period "
        f"({start:%Y-%m-%d} to {end:%Y-%m-%d})."
    )
