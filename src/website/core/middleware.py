import logging

from django.contrib import messages
from django.http import HttpResponseRedirect

logger = logging.getLogger(__name__)


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
        except Exception:
            if self._should_handle(request):
                logger.exception("Admin upload failed at %s", request.path)
                self._add_message(request)
                return HttpResponseRedirect(self._redirect_target(request))
            raise

    def _should_handle(self, request) -> bool:
        return (
            request.method == "POST"
            and request.path.startswith(self.admin_prefix)
            and bool(getattr(request, "FILES", None))
        )

    def _add_message(self, request) -> None:
        if hasattr(request, "_messages"):
            messages.error(
                request,
                "Upload failed. Please confirm Cloudinary credentials, file type, and file size, then try again.",
            )

    def _redirect_target(self, request) -> str:
        referer = request.META.get("HTTP_REFERER")
        return referer or request.path
