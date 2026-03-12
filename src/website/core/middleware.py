import logging
from typing import Optional

from django.contrib import messages
from django.core.exceptions import SuspiciousOperation, ValidationError
from django.db import close_old_connections, connections
from django.db.utils import DatabaseError, InterfaceError, OperationalError
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.http.multipartparser import MultiPartParserError
from django.utils.http import url_has_allowed_host_and_scheme

logger = logging.getLogger(__name__)

UPLOAD_EXCEPTIONS = (
    ValidationError,
    MultiPartParserError,
    SuspiciousOperation,
    OSError,
)


class DatabaseConnectionRecoveryMiddleware:
    """
    Recover from transient database disconnects and return 503 when unavailable.

    This middleware is intentionally conservative:
    - It retries only safe HTTP methods once (GET/HEAD/OPTIONS).
    - It only handles connection-level database errors.
    - It preserves normal exception behavior for non-transient DB failures.
    """

    api_prefix = "/website/api/"
    safe_retry_methods = {"GET", "HEAD", "OPTIONS"}
    transient_error_markers = (
        "connection already closed",
        "ssl connection has been closed unexpectedly",
        "connection refused",
        "could not connect to server",
        "server closed the connection unexpectedly",
        "terminating connection due to administrator command",
        "connection reset by peer",
        "broken pipe",
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        close_old_connections()
        try:
            return self.get_response(request)
        except (OperationalError, InterfaceError, DatabaseError) as exc:
            if not self._is_transient_connection_error(exc):
                raise

            logger.exception(
                "Transient database connectivity error at %s %s",
                request.method,
                request.path,
            )
            connections.close_all()

            # Retry safe/idempotent requests once after resetting connections.
            if request.method in self.safe_retry_methods:
                try:
                    response = self.get_response(request)
                    logger.warning(
                        "Recovered from transient database error after one retry at %s %s",
                        request.method,
                        request.path,
                    )
                    return response
                except (OperationalError, InterfaceError, DatabaseError) as retry_exc:
                    if not self._is_transient_connection_error(retry_exc):
                        raise
                    logger.exception(
                        "Database retry failed at %s %s",
                        request.method,
                        request.path,
                    )
                    connections.close_all()

            return self._service_unavailable_response(request)
        finally:
            close_old_connections()

    def _is_transient_connection_error(self, exc: Exception) -> bool:
        sqlstate = self._extract_sqlstate(exc)
        if sqlstate and sqlstate.startswith("08"):
            # SQLSTATE class 08: connection exceptions
            return True

        error_text = str(exc).lower()
        return any(marker in error_text for marker in self.transient_error_markers)

    def _extract_sqlstate(self, exc: Exception) -> Optional[str]:
        current = exc
        for _ in range(4):
            if current is None:
                break

            pgcode = getattr(current, "pgcode", None)
            if isinstance(pgcode, str) and pgcode:
                return pgcode

            current = getattr(current, "__cause__", None) or getattr(current, "__context__", None)

        return None

    def _service_unavailable_response(self, request):
        message = "Database temporarily unavailable. Please retry shortly."
        if request.path.startswith(self.api_prefix):
            response = JsonResponse({"detail": message}, status=503)
        else:
            response = HttpResponse(message, status=503)

        response["Retry-After"] = "5"
        return response


class AdminUploadExceptionMiddleware:
    """
    Convert admin upload exceptions into a safe redirect with a user-facing message.
    This prevents hard 500 responses from dropping the admin session context.
    """

    admin_prefix = "/website/admin/"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            return self.get_response(request)
        except UPLOAD_EXCEPTIONS as exc:
            if self._should_handle(request):
                if isinstance(exc, ValidationError):
                    logger.warning("Admin upload validation failed at %s: %s", request.path, exc)
                else:
                    logger.exception("Admin upload failed at %s", request.path)
                self._add_message(request, exc)
                return HttpResponseRedirect(self._redirect_target(request))
            raise

    def _should_handle(self, request) -> bool:
        if request.method != "POST" or not request.path.startswith(self.admin_prefix):
            return False

        # Trust multipart content-type as upload intent; avoids forcing FILES parse in error paths.
        content_type = (request.META.get("CONTENT_TYPE") or "").lower()
        if "multipart/form-data" in content_type:
            return True

        return (
            bool(getattr(request, "FILES", None))
        )

    def _add_message(self, request, exc=None) -> None:
        if hasattr(request, "_messages"):
            if isinstance(exc, ValidationError):
                message = "; ".join(str(item) for item in exc.messages) if exc.messages else str(exc)
                messages.error(request, message)
                return
            messages.error(
                request,
                "Upload failed. Please confirm Cloudinary credentials, file type, and file size, then try again.",
            )

    def _redirect_target(self, request) -> str:
        referer = request.META.get("HTTP_REFERER")
        if referer:
            try:
                if url_has_allowed_host_and_scheme(
                    referer,
                    allowed_hosts={request.get_host()},
                    require_https=request.is_secure(),
                ):
                    return referer
            except Exception:
                pass
        return request.path
