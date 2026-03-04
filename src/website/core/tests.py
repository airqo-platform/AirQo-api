from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, SimpleTestCase

from core.middleware import AdminUploadExceptionMiddleware


class AdminUploadExceptionMiddlewareTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    @staticmethod
    def _raise_error(_request):
        raise RuntimeError("upload failed")

    def test_admin_upload_exception_redirects_instead_of_500(self):
        middleware = AdminUploadExceptionMiddleware(self._raise_error)
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
        middleware = AdminUploadExceptionMiddleware(self._raise_error)
        request = self.factory.post(
            "/website/admin/team/member/add/",
            {"name": "Member without file"},
        )

        with self.assertRaises(RuntimeError):
            middleware(request)
