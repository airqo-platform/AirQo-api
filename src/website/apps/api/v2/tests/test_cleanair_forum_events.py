from django.test import TestCase, Client
from apps.cleanair.models import ForumEvent
from django.urls import reverse
import datetime


class ForumEventV2TestCase(TestCase):
    def setUp(self):
        # Create two forum events
        self.e1 = ForumEvent.objects.create(
            title="CLEAN-Air Forum 2023, Kampala, Uganda",
            start_date=datetime.date(2023, 9, 10),
        )
        self.e2 = ForumEvent.objects.create(
            title="Clean Air Forum 2024, Lagos, Nigeria",
            start_date=datetime.date(2024, 9, 10),
        )
        # Ensure unique_title generated
        self.e1.refresh_from_db()
        self.e2.refresh_from_db()

        self.client = Client()

    def test_retrieve_by_unique_title(self):
        url = f"/website/api/v2/forum-events/{self.e2.unique_title}/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get('unique_title'), self.e2.unique_title)

    def test_retrieve_latest(self):
        url = "/website/api/v2/forum-events/latest/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        # latest should be e2 because its start_date is later
        self.assertEqual(data.get('unique_title'), self.e2.unique_title)

    def test_retrieve_unknown_slug_returns_404(self):
        url = "/website/api/v2/forum-events/this-does-not-exist-xyz/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 404)
