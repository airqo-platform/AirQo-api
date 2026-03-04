import logging
from unittest import mock

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, SimpleTestCase, override_settings

from core.logging_handlers import SlackWebhookHandler
from core.middleware import AdminUploadExceptionMiddleware
from utils.fields import validate_image_format
from utils.validators import validate_image


class AdminUploadExceptionMiddlewareTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    @staticmethod
    def _raise_runtime_error(_request):
        raise RuntimeError("upload failed")

    @staticmethod
    def _raise_validation_error(_request):
        raise ValidationError("invalid upload")

    def test_admin_upload_validation_error_redirects_instead_of_500(self):
        middleware = AdminUploadExceptionMiddleware(self._raise_validation_error)
        upload = SimpleUploadedFile(
            "avatar.jpg", b"fake-image-bytes", content_type="image/jpeg"
        )
        request = self.factory.post(
            "/website/admin/team/member/add/",
            {"picture": upload},
            HTTP_REFERER="/website/admin/team/member/add/",
        )

        response = middleware(request)

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/website/admin/team/member/add/")

    def test_non_upload_post_errors_are_not_swallowed(self):
        middleware = AdminUploadExceptionMiddleware(self._raise_runtime_error)
        request = self.factory.post(
            "/website/admin/team/member/add/",
            {"name": "Member without file"},
        )

        with self.assertRaises(RuntimeError):
            middleware(request)

    def test_non_upload_exception_with_files_is_not_swallowed(self):
        middleware = AdminUploadExceptionMiddleware(self._raise_runtime_error)
        upload = SimpleUploadedFile(
            "avatar.jpg", b"fake-image-bytes", content_type="image/jpeg"
        )
        request = self.factory.post(
            "/website/admin/team/member/add/",
            {"picture": upload},
        )

        with self.assertRaises(RuntimeError):
            middleware(request)

    def test_redirect_target_rejects_external_referer(self):
        middleware = AdminUploadExceptionMiddleware(lambda request: None)
        request = self.factory.post(
            "/website/admin/team/member/add/",
            HTTP_REFERER="https://evil.example/redirect",
        )

        self.assertEqual(
            middleware._redirect_target(request),
            "/website/admin/team/member/add/",
        )


class SlackWebhookHandlerTests(SimpleTestCase):
    def test_slack_handler_sends_and_deduplicates(self):
        handler = SlackWebhookHandler(
            webhook_url="https://example.com/webhook",
            channel="#dev-alerts",
            dedupe_window_seconds=60,
        )
        handler.setFormatter(logging.Formatter("%(levelname)s %(message)s"))

        with mock.patch.object(handler.session, "post") as mocked_post:
            logger = logging.getLogger("tests.slack")
            logger.handlers = [handler]
            logger.propagate = False
            logger.setLevel(logging.ERROR)

            logger.error("Database connection failed")
            logger.error("Database connection failed")

            self.assertEqual(mocked_post.call_count, 1)


class UploadValidationTests(SimpleTestCase):
    @override_settings(UPLOAD_MAX_FILE_SIZE=10 * 1024 * 1024)
    def test_validate_image_rejects_files_above_configured_limit(self):
        oversized_file = SimpleUploadedFile(
            "avatar.jpg",
            b"\xff\xd8\xff" + (b"a" * (10 * 1024 * 1024)),
            content_type="image/jpeg",
        )

        with self.assertRaises(ValidationError):
            validate_image(oversized_file)

    @override_settings(UPLOAD_MAX_FILE_SIZE=10 * 1024 * 1024)
    def test_validate_image_format_rejects_files_above_configured_limit(self):
        oversized_file = SimpleUploadedFile(
            "avatar.jpg",
            b"\xff\xd8\xff" + (b"a" * (10 * 1024 * 1024)),
            content_type="image/jpeg",
        )

        with self.assertRaises(ValidationError):
            validate_image_format(oversized_file)
