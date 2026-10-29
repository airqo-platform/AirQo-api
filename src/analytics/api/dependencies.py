"""
Shared FastAPI dependencies.

Identity resolution
-------------------
Authentication happens upstream at the API gateway; this service never sees
credentials.  What it *did* do, though, was take the acting user's identity
straight from a client-supplied query parameter (``?userId=``), which meant
any caller could read another user's export records — including their GCS
download links — or reschedule someone else's export by guessing a request id.

The fix is to prefer an identity the gateway asserts via a trusted header.
Because that header has to be wired up on the gateway side first, the
behaviour is staged:

* header present, no query param            -> use the header
* header present, query param agrees        -> use it
* header present, query param disagrees     -> 403
* header absent, ``require_gateway_identity`` off -> fall back to the query
  parameter (current behaviour, so nothing breaks during the transition)
* header absent, ``require_gateway_identity`` on  -> 401

Flip ``REQUIRE_GATEWAY_IDENTITY=true`` once the gateway is confirmed to send
the header, and the query-parameter fallback is closed off for good.
"""

from typing import Optional

from fastapi import HTTPException, Query, Request

from config import settings


def _asserted_identity(request: Request) -> Optional[str]:
    """Return the gateway-asserted user id, if the header is present."""
    value = request.headers.get(settings.identity_header)
    return value.strip() if value and value.strip() else None


async def resolve_user_id(
    request: Request,
    userId: str = Query(
        ...,
        min_length=1,
        description=(
            "User whose records to act on. Ignored when the gateway asserts an "
            "identity header; a mismatch between the two is rejected with 403."
        ),
    ),
) -> str:
    """Resolve the acting user for endpoints that scope results to one user."""
    asserted = _asserted_identity(request)

    if asserted is None:
        if settings.require_gateway_identity:
            raise HTTPException(
                status_code=401, detail="Missing gateway-asserted identity"
            )
        return userId

    if userId and userId != asserted:
        raise HTTPException(
            status_code=403, detail="Requested user does not match authenticated user"
        )

    return asserted


async def optional_caller_id(request: Request) -> Optional[str]:
    """
    Resolve the acting user for endpoints that carry no ``userId`` parameter
    (e.g. ``PATCH /data-export?requestId=``), where ownership is checked
    against the stored record instead.

    Returns ``None`` when no identity is asserted and the gateway header is
    not yet mandatory — callers must treat that as "ownership unenforceable".
    """
    asserted = _asserted_identity(request)

    if asserted is None and settings.require_gateway_identity:
        raise HTTPException(status_code=401, detail="Missing gateway-asserted identity")

    return asserted
