from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from apps.api.v2.viewsets.event import EventPartnerCatalogViewSet
from apps.api.v2.viewsets.partners import PartnerViewSet


class PartnerCacheNamespaceTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_event_partner_catalog_list_uses_a_distinct_cache_prefix(self):
        request = Request(self.factory.get("/event-partners/"))

        event_partners = EventPartnerCatalogViewSet()
        partners = PartnerViewSet()

        with patch.object(event_partners, "get_cached_response", return_value=[]):
            with patch.object(
                event_partners,
                "get_cache_key",
                wraps=event_partners.get_cache_key,
            ) as event_key:
                event_partners.list(request)

        with patch.object(partners, "get_cached_response", return_value=[]):
            with patch.object(
                partners,
                "get_cache_key",
                wraps=partners.get_cache_key,
            ) as partner_key:
                partners.list(request)

        self.assertEqual(event_key.call_args.args[0], "event_partner_catalog_list")
        self.assertEqual(partner_key.call_args.args[0], "partner_list")
        self.assertNotEqual(event_key.call_args.args[0], partner_key.call_args.args[0])

    def test_event_partner_catalog_detail_uses_a_distinct_cache_prefix(self):
        request = Request(self.factory.get("/event-partners/example/"))
        event_partners = EventPartnerCatalogViewSet()
        partners = PartnerViewSet()

        with patch.object(event_partners, "get_cached_response", return_value={}):
            with patch.object(
                event_partners,
                "get_cache_key",
                wraps=event_partners.get_cache_key,
            ) as event_key:
                event_partners.retrieve(request, slug="example")

        with patch.object(partners, "get_cached_response", return_value={}):
            with patch.object(
                partners,
                "get_cache_key",
                wraps=partners.get_cache_key,
            ) as partner_key:
                partners.retrieve(request, slug="example")

        self.assertEqual(event_key.call_args.args[0], "event_partner_catalog_detail")
        self.assertEqual(partner_key.call_args.args[0], "partner_detail")
        self.assertNotEqual(event_key.call_args.args[0], partner_key.call_args.args[0])
