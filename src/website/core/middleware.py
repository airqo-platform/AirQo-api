import logging

from django.contrib import messages
from django.core.exceptions import SuspiciousOperation, ValidationError
from django.http import HttpResponseRedirect
from django.http.multipartparser import MultiPartParserError
from django.utils.http import url_has_allowed_host_and_scheme

logger = logging.getLogger(__name__)

UPLOAD_EXCEPTIONS = (
    ValidationError,
    MultiPartParserError,
    SuspiciousOperation,
    OSError,
)


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
