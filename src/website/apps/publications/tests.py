
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.cache import cache
from django.http import QueryDict
from django.test import Client, SimpleTestCase, TestCase, TransactionTestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.publications.models import (
    LivePublicationFeedSettings,
    LivePublicationOverride,
    Publication,
)
from apps.api.v2.utils import CachedViewSetMixin


class PublicationApiPerformanceTests(TestCase):
    def setUp(self):
        cache.clear()
        Publication.objects.create(
            title="Air quality monitoring in Kampala",
            authors="AirQo Research Team",
        )
        Publication.objects.create(
            title="Low-cost sensors for clean air",
            authors="AirQo Research Team",
        )

    def tearDown(self):
        cache.clear()

    def test_list_keeps_slug_selected_without_per_row_deferred_queries(self):
        with self.assertNumQueries(2):
            response = self.client.get(
                reverse("v2-publications-list"),
                {"page_size": 2},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]), 2)
        self.assertTrue(all(item["has_slug"] for item in response.data["results"]))


class CachedViewSetKeyTests(SimpleTestCase):
    def test_cache_key_preserves_and_normalizes_repeated_query_parameters(self):
        mixin = CachedViewSetMixin()
        first = QueryDict("identifier=one&identifier=two")
        reordered = QueryDict("identifier=two&identifier=one")
        different = QueryDict("identifier=one")

        self.assertEqual(
            mixin.get_cache_key("overrides", query_params=first),
            mixin.get_cache_key("overrides", query_params=reordered),
        )
        self.assertNotEqual(
            mixin.get_cache_key("overrides", query_params=first),
            mixin.get_cache_key("overrides", query_params=different),
        )


class LivePublicationOverrideApiTests(TransactionTestCase):
    def setUp(self):
        self.client = APIClient()
        self.doi_override = LivePublicationOverride.objects.create(
            external_identifier="doi:10.1234/example",
            authors="Corrected Author\nSecond Author",
            journal="Air Quality Journal",
        )
        LivePublicationOverride.objects.create(
            external_identifier="openalex:W123456789",
            authors="OpenAlex-only Author",
        )

    def test_list_returns_only_requested_overrides_and_splits_authors(self):
        url = reverse("v2-live-publication-overrides-list")

        response = self.client.get(
            url,
            [
                ("identifier", "doi:10.1234/example"),
                ("identifier", "openalex:W123456789"),
            ],
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertEqual(len(response.data), 2)
        result = next(
            item
            for item in response.data
            if item["external_identifier"]
            == self.doi_override.external_identifier
        )
        self.assertEqual(result["authors"], ["Corrected Author", "Second Author"])
        self.assertEqual(result["journal"], "Air Quality Journal")

    def test_list_without_identifiers_returns_no_records(self):
        response = self.client.get(reverse("v2-live-publication-overrides-list"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_rejects_more_than_one_hundred_identifiers(self):
        url = reverse("v2-live-publication-overrides-list")
        query = [("identifier", f"openalex:W{index}") for index in range(101)]

        response = self.client.get(url, query)

        self.assertEqual(response.status_code, 400)
        self.assertIn("identifier", response.data)

    def test_public_api_does_not_allow_writes(self):
        response = self.client.post(
            reverse("v2-live-publication-overrides-list"),
            {
                "external_identifier": "doi:10.1234/new",
                "authors": ["Unauthorised Author"],
                "journal": "Unauthorised Journal",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 405)
        self.assertFalse(
            LivePublicationOverride.objects.filter(
                external_identifier="doi:10.1234/new"
            ).exists()
        )

    def test_metadata_overrides_are_not_exposed_in_staff_admin(self):
        self.assertNotIn(LivePublicationOverride, admin.site._registry)


class LivePublicationFeedSettingsApiTests(TransactionTestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse("v2-live-publication-feed-settings")
        LivePublicationFeedSettings.get_solo(create=True)

    def test_public_endpoint_returns_only_non_secret_policy(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            set(response.data),
            {
                "enabled",
                "openalex_author_ids",
                "allowed_affiliations",
                "relevance_keywords",
                "relevance_required",
                "openalex_api_url",
                "crossref_api_url",
                "crossref_mailto",
                "updated_at",
            },
        )
        self.assertTrue(response.data["enabled"])
        self.assertIn("A5047583981", response.data["openalex_author_ids"])
        self.assertEqual(response.data["allowed_affiliations"], ["AirQo"])
        self.assertTrue(response.data["relevance_required"])
        self.assertEqual(
            response.data["openalex_api_url"], "https://api.openalex.org/works"
        )
        self.assertEqual(
            response.data["crossref_api_url"], "https://api.crossref.org/works"
        )
        self.assertEqual(response.data["crossref_mailto"], "info@airqo.net")
        self.assertEqual(response["Cache-Control"], "no-store")

    def test_admin_changes_are_returned_without_a_frontend_deploy(self):
        settings = LivePublicationFeedSettings.get_solo(create=True)
        settings.enabled = False
        settings.openalex_author_ids = "A5047583981\nA5051886991"
        settings.allowed_affiliations = "AirQo\nMakerere University"
        settings.relevance_keywords = "PM2.5\nblack carbon"
        settings.relevance_required = False
        settings.openalex_api_url = "https://api.openalex.org/works"
        settings.crossref_api_url = "https://api.crossref.org/works"
        settings.crossref_mailto = "research@airqo.net"
        settings.save()

        response = self.client.get(self.url)

        self.assertFalse(response.data["enabled"])
        self.assertEqual(
            response.data["openalex_author_ids"],
            ["A5047583981", "A5051886991"],
        )
        self.assertEqual(
            response.data["allowed_affiliations"],
            ["AirQo", "Makerere University"],
        )
        self.assertEqual(response.data["relevance_keywords"], ["PM2.5", "black carbon"])
        self.assertFalse(response.data["relevance_required"])
        self.assertEqual(response.data["crossref_mailto"], "research@airqo.net")

    def test_public_endpoint_fails_closed_when_singleton_is_missing(self):
        LivePublicationFeedSettings.objects.all().delete()

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.data, {"error": "Publication feed settings are not initialized."}
        )
        self.assertFalse(LivePublicationFeedSettings.objects.filter(pk=1).exists())

    def test_public_endpoint_does_not_allow_writes(self):
        response = self.client.post(
            self.url,
            {"enabled": False},
            format="json",
        )

        self.assertEqual(response.status_code, 405)

    def test_feed_settings_are_registered_in_staff_admin(self):
        self.assertIn(LivePublicationFeedSettings, admin.site._registry)

    def test_invalid_author_ids_are_rejected_before_they_reach_the_api(self):
        settings = LivePublicationFeedSettings.get_solo(create=True)
        settings.openalex_author_ids = "A123,not-an-openalex-id"

        with self.assertRaises(ValidationError):
            settings.full_clean()

    def test_provider_endpoints_are_restricted_to_official_https_hosts(self):
        settings = LivePublicationFeedSettings.get_solo(create=True)
        settings.openalex_api_url = "https://attacker.example/works"

        with self.assertRaises(ValidationError):
            settings.full_clean()


class LivePublicationFeedSettingsAdminTests(TransactionTestCase):
    def setUp(self):
        self.client = Client()
        self.settings = LivePublicationFeedSettings.get_solo(create=True)
        user_model = get_user_model()
        user = user_model.objects.create_superuser(
            username="publication-admin",
            email="publication-admin@example.com",
            password="test-password-123",
        )
        self.client.force_login(user)

    def test_admin_can_disable_feed_and_update_author_policy(self):
        response = self.client.post(
            reverse(
                "admin:publications_livepublicationfeedsettings_change",
                args=[self.settings.pk],
            ),
            {
                "openalex_author_ids": "A5000000001\nA5000000002",
                "allowed_affiliations": "AirQo",
                "relevance_keywords": "air quality",
                "relevance_required": "on",
                "openalex_api_url": "https://api.openalex.org/works",
                "crossref_api_url": "https://api.crossref.org/works",
                "crossref_mailto": "info@airqo.net",
                "_save": "Save",
            },
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.settings.refresh_from_db()
        self.assertFalse(self.settings.enabled)
        self.assertEqual(
            self.settings.openalex_author_id_list,
            ["A5000000001", "A5000000002"],
        )
        self.assertTrue(self.settings.relevance_required)

    def test_changelist_has_a_visible_airqo_edit_target(self):
        response = self.client.get(
            reverse("admin:publications_livepublicationfeedsettings_changelist")
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "AirQo research publications")
        self.assertContains(
            response,
            reverse(
                "admin:publications_livepublicationfeedsettings_change",
                args=[self.settings.pk],
            ),
        )

    def test_change_form_uses_comms_friendly_labels_and_guidance(self):
        response = self.client.get(
            reverse(
                "admin:publications_livepublicationfeedsettings_change",
                args=[self.settings.pk],
            )
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Show live AirQo publications on the website")
        self.assertContains(response, "AirQo researcher IDs (OpenAlex)")
        self.assertContains(response, "Technical provider settings (advanced)")
        self.assertContains(response, "The OpenAlex API key is kept on the server")

    def test_staff_without_add_permission_cannot_create_missing_settings(self):
        self.settings.delete()
        user_model = get_user_model()
        restricted_user = user_model.objects.create_user(
            username="publication-viewer",
            password="test-password-123",
            is_staff=True,
        )
        self.client.force_login(restricted_user)

        response = self.client.get(
            reverse("admin:publications_livepublicationfeedsettings_add")
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(LivePublicationFeedSettings.objects.exists())
