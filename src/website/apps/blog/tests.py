from datetime import date, timedelta
from importlib import import_module
from django.utils import timezone
from unittest import mock

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from django.core.cache import cache
from rest_framework.test import APIRequestFactory

from apps.blog.models import BlogPost
from apps.blog.views import BlogPostViewSet
from apps.event.models import (
    Event, Organizer, EventOrganizer, EventSideEvent,
    Partner, EventPartner, PartnerLogo,
)
from apps.event.views import EventViewSet

V2BlogPostViewSet = import_module('apps.api.v2.viewsets.blogs').BlogPostViewSet
V2EventViewSet = import_module('apps.api.v2.viewsets.event').EventViewSet
V2OrganizerViewSet = import_module(
    'apps.api.v2.viewsets.event').OrganizerViewSet
V2EventOrganizerViewSet = import_module(
    'apps.api.v2.viewsets.event').EventOrganizerViewSet
V2EventSideEventViewSet = import_module(
    'apps.api.v2.viewsets.event').EventSideEventViewSet
V2PartnerViewSet = import_module(
    'apps.api.v2.viewsets.event').EventPartnerCatalogViewSet
V2EventPartnerViewSet = import_module(
    'apps.api.v2.viewsets.event').EventPartnerViewSet


class BlogApiTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        cache.clear()

    def test_blog_list_returns_only_published_posts_in_order(self):
        BlogPost.objects.create(
            title='Second post',
            summary='Second summary',
            author_name='AirQo Team',
            order=2,
            is_published=True,
        )
        BlogPost.objects.create(
            title='First post',
            summary='First summary',
            author_name='AirQo Team',
            author_role='Editor',
            meta_title='First post SEO title',
            meta_description='First post SEO description',
            order=1,
            is_published=True,
        )
        BlogPost.objects.create(
            title='Draft post',
            summary='Draft summary',
            author_name='AirQo Team',
            order=0,
            is_published=False,
        )

        self.assertEqual(reverse('blogpost-list'), '/website/blogs/')

        request = self.factory.get(reverse('blogpost-list'))
        response = BlogPostViewSet.as_view({'get': 'list'})(request)

        self.assertEqual(response.status_code, 200)
        payload = response.data['results']
        self.assertEqual(response.data['count'], 2)
        self.assertEqual([item['title'] for item in payload], ['First post', 'Second post'])
        self.assertEqual([item['order'] for item in payload], [1, 2])
        self.assertEqual(payload[0]['author_role'], 'Editor')
        self.assertEqual(payload[0]['meta_title'], 'First post SEO title')
        self.assertEqual(payload[0]['meta_description'], 'First post SEO description')

    def test_v2_blog_list_exposes_new_fields(self):
        blog_post = BlogPost.objects.create(
            title='V2 blog post',
            summary='Summary',
            author_name='AirQo Team',
            author_role='Lead Writer',
            meta_title='V2 meta title',
            meta_description='V2 meta description',
            order=1,
            is_published=True,
        )

        self.assertEqual(reverse('v2-blogs-list'), '/website/api/v2/blogs/')

        request = self.factory.get(reverse('v2-blogs-list'))
        response = V2BlogPostViewSet.as_view({'get': 'list'})(request)

        self.assertEqual(response.status_code, 200)
        payload = response.data['results']
        self.assertEqual(payload[0]['id'], blog_post.pk)
        self.assertEqual(payload[0]['author_role'], 'Lead Writer')
        self.assertEqual(payload[0]['meta_title'], 'V2 meta title')
        self.assertEqual(payload[0]['meta_description'], 'V2 meta description')

    def test_v2_blog_list_uses_deterministic_tiebreaker(self):
        published_at = timezone.now()
        first = BlogPost.objects.create(
            title='Earlier row',
            summary='Summary',
            author_name='AirQo Team',
            order=1,
            published_at=published_at,
            is_published=True,
        )
        second = BlogPost.objects.create(
            title='Later row',
            summary='Summary',
            author_name='AirQo Team',
            order=1,
            published_at=published_at,
            is_published=True,
        )

        request = self.factory.get(reverse('v2-blogs-list'))
        response = V2BlogPostViewSet.as_view({'get': 'list'})(request)

        self.assertEqual(response.status_code, 200)
        payload = response.data['results']
        self.assertEqual([item['title'] for item in payload[:2]], [second.title, first.title])

    @mock.patch('apps.blog.models.safe_destroy')
    def test_blog_delete_cleans_up_both_images(self, mocked_destroy):
        post = BlogPost.objects.create(
            title='Delete me',
            summary='Summary',
            author_name='AirQo Team',
            order=1,
            is_published=True,
        )
        post.author_image = 'website/uploads/blog/authors/author.jpg'
        post.cover_image = 'website/uploads/blog/images/cover.jpg'

        with mock.patch('django.db.transaction.on_commit', side_effect=lambda func: func()):
            post.delete()

        self.assertEqual(mocked_destroy.call_args_list[0].args[0], 'website/uploads/blog/authors/author.jpg')
        self.assertEqual(mocked_destroy.call_args_list[1].args[0], 'website/uploads/blog/images/cover.jpg')
        self.assertEqual(mocked_destroy.call_count, 2)


class EventApiTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def _create_event(self, title, order, tag=Event.EventTag.UNTAGGED):
        return Event.objects.create(
            title=title,
            title_subtext=f'{title} subtitle',
            start_date=date(2026, 5, 10),
            event_tag=tag,
            order=order,
        )

    def test_featured_events_endpoint_returns_only_featured_events(self):
        self._create_event('Featured late', 2, Event.EventTag.FEATURED)
        self._create_event('Regular event', 1, Event.EventTag.UNTAGGED)
        self._create_event('Featured early', 1, Event.EventTag.FEATURED)

        self.assertEqual(reverse('event-featured'), '/website/events/featured/')

        request = self.factory.get(reverse('event-featured'))
        response = EventViewSet.as_view({'get': 'featured'})(request)

        self.assertEqual(response.status_code, 200)
        payload = response.data
        self.assertEqual([item['title'] for item in payload], ['Featured early', 'Featured late'])
        self.assertEqual([item['order'] for item in payload], [1, 2])

    def test_event_list_exposes_order_field(self):
        self._create_event('Ordered one', 1)
        self._create_event('Ordered two', 2)

        self.assertEqual(reverse('event-list'), '/website/events/')

        request = self.factory.get(reverse('event-list'))
        response = EventViewSet.as_view({'get': 'list'})(request)

        self.assertEqual(response.status_code, 200)
        payload = response.data
        self.assertEqual([item['order'] for item in payload], [1, 2])


class V2EventApiTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def _create_event(self, title, start_date_value, order=1, tag=Event.EventTag.UNTAGGED):
        event = Event.objects.create(
            title=title,
            title_subtext=f'{title} subtitle',
            start_date=start_date_value,
            event_tag=tag,
            order=order,
        )
        Event.objects.filter(pk=event.pk).update(event_details='legacy plain text')
        return Event.objects.get(pk=event.pk)

    def test_featured_endpoint_handles_legacy_quill_data(self):
        featured_event = self._create_event('Featured event', date(2026, 6, 10), tag=Event.EventTag.FEATURED)

        request = self.factory.get(reverse('v2-events-featured'))
        response = V2EventViewSet.as_view({'get': 'featured'})(request)

        self.assertEqual(response.status_code, 200)
        payload = response.data['results']
        self.assertEqual([item['title'] for item in payload], [featured_event.title])

    def test_upcoming_endpoint_handles_legacy_quill_data(self):
        # create an event always in the future relative to today
        future_date = date.today() + timedelta(days=30)
        upcoming_event = self._create_event('Upcoming event', future_date)

        request = self.factory.get(reverse('v2-events-upcoming'))
        response = V2EventViewSet.as_view({'get': 'upcoming'})(request)

        self.assertEqual(response.status_code, 200)
        payload = response.data['results']
        self.assertEqual([item['title'] for item in payload], [upcoming_event.title])

    def test_past_endpoint_handles_legacy_quill_data(self):
        # create an event always in the past relative to today
        past_date = date.today() - timedelta(days=30)
        past_event = self._create_event('Past event', past_date)

        request = self.factory.get(reverse('v2-events-past'))
        response = V2EventViewSet.as_view({'get': 'past'})(request)

        self.assertEqual(response.status_code, 200)
        payload = response.data['results']
        self.assertEqual([item['title'] for item in payload], [past_event.title])

    def test_calendar_endpoint_handles_legacy_quill_data(self):
        calendar_event = self._create_event('Calendar event', date(2026, 6, 12))

        request = self.factory.get(reverse('v2-events-calendar'))
        response = V2EventViewSet.as_view({'get': 'calendar'})(request)

        self.assertEqual(response.status_code, 200)
        self.assertIn(calendar_event.start_date.strftime('%Y-%m-%d'), response.data['calendar'])


class EventOrganizersAndSideEventsTests(TestCase):
    """
    Tests for the new Organizer / EventOrganizer / EventSideEvent models
    and the related API exposure.
    """

    def setUp(self):
        self.factory = APIRequestFactory()
        cache.clear()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _make_event(self, title, **kwargs):
        defaults = dict(
            title_subtext=f"{title} subtitle",
            start_date=date(2026, 6, 24),
            order=1,
        )
        defaults.update(kwargs)
        return Event.objects.create(title=title, **defaults)

    def _make_organizer(self, name, **kwargs):
        return Organizer.objects.create(name=name, **kwargs)

    # ------------------------------------------------------------------
    # Model-level tests
    # ------------------------------------------------------------------
    def test_create_organizer_auto_generates_unique_slug(self):
        org = self._make_organizer('AirQo')
        self.assertTrue(org.slug)
        self.assertEqual(org.slug, 'airqo')

        org2 = self._make_organizer('AirQo')
        # Second org with the same name should get a unique slug.
        self.assertNotEqual(org.slug, org2.slug)
        self.assertTrue(org2.slug.startswith('airqo'))

    def test_link_organizer_to_event_creates_event_organizer_row(self):
        event = self._make_event('AirQo Clean Air Week 2026')
        org = self._make_organizer('AirQo')
        link = EventOrganizer.objects.create(
            event=event, organizer=org, role='organizer', order=1
        )
        self.assertEqual(link.event, event)
        self.assertEqual(link.organizer, org)
        self.assertEqual(link.role, 'organizer')
        self.assertTrue(event.is_side_event is False)
        self.assertEqual(event.event_organizer_links.count(), 1)

    def test_duplicate_organizer_link_is_rejected_at_db_level(self):
        event = self._make_event('AirQo Clean Air Week 2026')
        org = self._make_organizer('AirQo')
        EventOrganizer.objects.create(event=event, organizer=org)
        with self.assertRaises(Exception):
            # Second link with the same (event, organizer) violates the
            # unique constraint and should fail.
            EventOrganizer.objects.create(event=event, organizer=org)

    def test_link_side_event_to_main_event(self):
        main_event = self._make_event('CCAC London Climate Action Week 2026')
        side_event = self._make_event(
            'Climate, Clean Air and Health: the Economic Case for Action')
        link = EventSideEvent.objects.create(
            parent_event=main_event, side_event=side_event,
            label='Side event', order=1,
        )
        self.assertEqual(link.parent_event, main_event)
        self.assertEqual(link.side_event, side_event)
        self.assertTrue(side_event.is_side_event)
        self.assertTrue(main_event.has_side_events)
        self.assertFalse(main_event.is_side_event)

    def test_duplicate_side_event_link_is_rejected_at_db_level(self):
        main_event = self._make_event('Main')
        side_event = self._make_event('Side')
        EventSideEvent.objects.create(
            parent_event=main_event, side_event=side_event)
        with self.assertRaises(Exception):
            EventSideEvent.objects.create(
                parent_event=main_event, side_event=side_event)

    def test_event_cannot_be_its_own_side_event(self):
        event = self._make_event('Self')
        link = EventSideEvent(
            parent_event=event, side_event=event)
        with self.assertRaises(ValidationError):
            link.full_clean()

    def test_circular_side_event_relationship_is_rejected(self):
        a = self._make_event('A')
        b = self._make_event('B')
        # A -> B is valid
        EventSideEvent.objects.create(parent_event=a, side_event=b)
        # Trying B -> A should be detected as a cycle and rejected.
        bad = EventSideEvent(parent_event=b, side_event=a)
        with self.assertRaises(ValidationError):
            bad.full_clean()

    def test_side_event_cannot_have_its_own_side_events(self):
        a = self._make_event('A')
        b = self._make_event('B')
        c = self._make_event('C')
        # A -> B
        EventSideEvent.objects.create(parent_event=a, side_event=b)
        # B -> C should be rejected (B is already a side event).
        bad = EventSideEvent(parent_event=b, side_event=c)
        with self.assertRaises(ValidationError):
            bad.full_clean()

    def test_deleting_event_does_not_delete_linked_organizer(self):
        event = self._make_event('Ephemeral')
        org = self._make_organizer('Persistent Org')
        EventOrganizer.objects.create(event=event, organizer=org)
        org_id = org.id
        event.delete()
        self.assertTrue(Organizer.objects.filter(id=org_id).exists())

    def test_deleting_organizer_does_not_delete_event(self):
        event = self._make_event('Survivor')
        org = self._make_organizer('Disposable')
        EventOrganizer.objects.create(event=event, organizer=org)
        event_id = event.id
        org.delete()
        self.assertTrue(Event.objects.filter(id=event_id).exists())

    def test_deleting_side_event_link_does_not_delete_child_event(self):
        main_event = self._make_event('Main')
        side_event = self._make_event('Side')
        link = EventSideEvent.objects.create(
            parent_event=main_event, side_event=side_event)
        side_id = side_event.id
        link.delete()
        # Both events still exist.
        self.assertTrue(Event.objects.filter(id=side_id).exists())
        self.assertTrue(Event.objects.filter(id=main_event.id).exists())

    # ------------------------------------------------------------------
    # Dummy data + API tests (matches the spec's acceptance scenario)
    # ------------------------------------------------------------------
    def _build_dummy_data(self):
        # Main event with three side events and two organizers.
        main_event = self._make_event('AirQo Clean Air Week 2026')
        s1 = self._make_event('Opening Roundtable')
        s2 = self._make_event('Community Air Quality Workshop')
        s3 = self._make_event('Policy and Health Dialogue')
        EventSideEvent.objects.bulk_create([
            EventSideEvent(parent_event=main_event, side_event=s1, order=1),
            EventSideEvent(parent_event=main_event, side_event=s2, order=2),
            EventSideEvent(parent_event=main_event, side_event=s3, order=3),
        ])
        airqo = self._make_organizer('AirQo')
        mak = self._make_organizer('Makerere University')
        EventOrganizer.objects.bulk_create([
            EventOrganizer(event=main_event, organizer=airqo, order=1),
            EventOrganizer(event=main_event, organizer=mak, order=2),
        ])
        return main_event, [s1, s2, s3], [airqo, mak]

    def test_v2_event_detail_returns_organizers_and_side_events(self):
        main_event, sides, orgs = self._build_dummy_data()
        # bust detail cache
        cache.clear()
        request = self.factory.get(
            reverse('v2-events-detail', kwargs={'slug': main_event.slug}))
        response = V2EventViewSet.as_view(
            {'get': 'retrieve'})(request, slug=main_event.slug)
        self.assertEqual(response.status_code, 200)
        data = response.data

        # Existing fields still present
        self.assertEqual(data['title'], 'AirQo Clean Air Week 2026')
        self.assertIn('inquiries', data)
        self.assertIn('programs', data)
        self.assertIn('partner_logos', data)
        self.assertIn('resources', data)
        self.assertIn('public_identifier', data)
        self.assertIn('api_url', data)
        self.assertIn('has_slug', data)
        self.assertIn('event_status', data)
        self.assertIn('duration_days', data)
        self.assertIn('is_virtual', data)

        # New nested fields
        self.assertIn('organizers', data)
        self.assertEqual(len(data['organizers']), 2)
        self.assertEqual(
            data['organizers'][0]['organizer']['name'], 'AirQo')
        self.assertEqual(data['organizers'][0]['role'], 'organizer')
        self.assertEqual(data['organizers'][0]['order'], 1)

        self.assertIn('side_events', data)
        self.assertEqual(len(data['side_events']), 3)
        titles = [se['title'] for se in data['side_events']]
        self.assertEqual(
            titles,
            ['Opening Roundtable',
             'Community Air Quality Workshop',
             'Policy and Health Dialogue'])
        # First side event summary exposes the lightweight keys
        first = data['side_events'][0]
        for key in ('public_identifier', 'api_url', 'title',
                    'start_date', 'event_image_url', 'event_status',
                    'order', 'label'):
            self.assertIn(key, first)

        self.assertEqual(data['is_side_event'], False)
        self.assertIsNone(data['side_event_of'])

    def test_v2_side_event_detail_returns_parent_backlink(self):
        main_event, sides, _ = self._build_dummy_data()
        side = sides[0]
        cache.clear()
        request = self.factory.get(
            reverse('v2-events-detail', kwargs={'slug': side.slug}))
        response = V2EventViewSet.as_view(
            {'get': 'retrieve'})(request, slug=side.slug)
        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertEqual(data['is_side_event'], True)
        self.assertIsNotNone(data['side_event_of'])
        self.assertEqual(
            data['side_event_of']['title'],
            'AirQo Clean Air Week 2026')
        self.assertIn('public_identifier', data['side_event_of'])
        self.assertIn('api_url', data['side_event_of'])

    def test_v2_event_list_excludes_side_events_by_default(self):
        """Side events should NOT appear in the default events list.
        They only appear nested under their parent event's detail page."""
        main_event, sides, _ = self._build_dummy_data()
        cache.clear()
        request = self.factory.get(reverse('v2-events-list'))
        response = V2EventViewSet.as_view({'get': 'list'})(request)
        self.assertEqual(response.status_code, 200)
        results = response.data['results']
        titles = {item['title'] for item in results}
        # Main event IS in the list
        self.assertIn('AirQo Clean Air Week 2026', titles)
        # Side events are NOT in the default list
        self.assertNotIn('Opening Roundtable', titles)
        self.assertNotIn('Community Air Quality Workshop', titles)
        self.assertNotIn('Policy and Health Dialogue', titles)

    def test_v2_event_list_organizers_count_on_main_event(self):
        main_event, sides, _ = self._build_dummy_data()
        cache.clear()
        request = self.factory.get(reverse('v2-events-list'))
        response = V2EventViewSet.as_view({'get': 'list'})(request)
        self.assertEqual(response.status_code, 200)
        by_title = {item['title']: item for item in response.data['results']}
        main_item = by_title['AirQo Clean Air Week 2026']
        self.assertEqual(main_item['organizers_count'], 2)
        self.assertEqual(main_item['partners_count'], 0)
        self.assertEqual(main_item['is_side_event'], False)

    def test_v2_is_side_event_filter_shows_only_side_events(self):
        self._build_dummy_data()
        cache.clear()
        request = self.factory.get(
            reverse('v2-events-list') + '?is_side_event=true')
        response = V2EventViewSet.as_view({'get': 'list'})(request)
        self.assertEqual(response.status_code, 200)
        titles = [item['title'] for item in response.data['results']]
        # Main event is NOT shown
        self.assertNotIn('AirQo Clean Air Week 2026', titles)
        # Side events ARE shown
        self.assertIn('Opening Roundtable', titles)

    def test_v2_main_events_only_filter_excludes_side_events(self):
        self._build_dummy_data()
        cache.clear()
        request = self.factory.get(
            reverse('v2-events-list') + '?main_events_only=true')
        response = V2EventViewSet.as_view({'get': 'list'})(request)
        self.assertEqual(response.status_code, 200)
        titles = [item['title'] for item in response.data['results']]
        self.assertIn('AirQo Clean Air Week 2026', titles)
        self.assertNotIn('Opening Roundtable', titles)
        self.assertNotIn('Community Air Quality Workshop', titles)
        self.assertNotIn('Policy and Health Dialogue', titles)

    def test_v2_is_side_event_filter_returns_only_side_events(self):
        self._build_dummy_data()
        cache.clear()
        request = self.factory.get(
            reverse('v2-events-list') + '?is_side_event=true')
        response = V2EventViewSet.as_view({'get': 'list'})(request)
        self.assertEqual(response.status_code, 200)
        titles = [item['title'] for item in response.data['results']]
        self.assertNotIn('AirQo Clean Air Week 2026', titles)
        self.assertIn('Opening Roundtable', titles)

    def test_v2_parent_event_filter_returns_only_side_events_for_parent(self):
        main_event, sides, _ = self._build_dummy_data()
        cache.clear()
        request = self.factory.get(
            reverse('v2-events-list') + f'?parent_event={main_event.slug}')
        response = V2EventViewSet.as_view({'get': 'list'})(request)
        self.assertEqual(response.status_code, 200)
        titles = {item['title'] for item in response.data['results']}
        self.assertIn('Opening Roundtable', titles)
        self.assertIn('Community Air Quality Workshop', titles)
        self.assertIn('Policy and Health Dialogue', titles)
        self.assertNotIn('AirQo Clean Air Week 2026', titles)

    def test_v2_event_list_still_returns_existing_fields_for_backward_compatibility(self):
        self._build_dummy_data()
        cache.clear()
        request = self.factory.get(reverse('v2-events-list'))
        response = V2EventViewSet.as_view({'get': 'list'})(request)
        self.assertEqual(response.status_code, 200)
        first = response.data['results'][0]
        for key in ('title', 'start_date', 'end_date', 'start_time',
                    'end_time', 'event_tag', 'event_tag_display',
                    'event_category', 'event_category_display',
                    'website_category', 'website_category_display',
                    'event_image_url', 'location_name', 'event_status',
                    'is_virtual', 'duration_days', 'registration_link',
                    'order', 'created', 'modified',
                    'public_identifier', 'api_url', 'has_slug'):
            self.assertIn(key, first, f"Missing legacy key: {key}")

    def test_slug_based_detail_lookup_still_works_after_migration(self):
        main_event, _, _ = self._build_dummy_data()
        cache.clear()
        # numeric id lookup (backward compat)
        request = self.factory.get(
            reverse('v2-events-detail', kwargs={'slug': str(main_event.id)}))
        response = V2EventViewSet.as_view(
            {'get': 'retrieve'})(request, slug=str(main_event.id))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['title'], 'AirQo Clean Air Week 2026')

    def test_organizer_detail_endpoint_exposes_new_organizer(self):
        org = self._make_organizer('Standalone Organizer')
        cache.clear()
        request = self.factory.get(
            reverse('v2-event-organizers-detail',
                    kwargs={'slug': org.slug}))
        response = V2OrganizerViewSet.as_view(
            {'get': 'retrieve'})(request, slug=org.slug)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'Standalone Organizer')
        self.assertEqual(response.data['slug'], org.slug)
        self.assertIn('logo_url', response.data)
        self.assertIn('website_url', response.data)

    def test_event_side_event_endpoint_returns_linked_side_events(self):
        main_event, sides, _ = self._build_dummy_data()
        cache.clear()
        request = self.factory.get(reverse('v2-event-side-events-list'))
        response = V2EventSideEventViewSet.as_view(
            {'get': 'list'})(request)
        self.assertEqual(response.status_code, 200)
        results = response.data['results']
        self.assertEqual(len(results), 3)
        # The first row's `side_event` resolves to the actual Event row.
        self.assertEqual(results[0]['title'], 'Opening Roundtable')


class EventPartnerCatalogTests(TestCase):
    """
    Tests for the Partner catalog and EventPartner through model.

    Partners are a reusable catalog (like Organizer) so the same
    organization does not need to be re-created for each event.
    """

    def setUp(self):
        self.factory = APIRequestFactory()
        cache.clear()

    def _make_event(self, title, **kwargs):
        defaults = dict(
            title_subtext=f"{title} subtitle",
            start_date=date(2026, 6, 24),
            order=1,
        )
        defaults.update(kwargs)
        return Event.objects.create(title=title, **defaults)

    def _make_partner(self, name, **kwargs):
        return Partner.objects.create(name=name, **kwargs)

    # ------------------------------------------------------------------
    # Model-level tests
    # ------------------------------------------------------------------
    def test_create_partner_auto_generates_unique_slug(self):
        p1 = self._make_partner('UNEP')
        self.assertTrue(p1.slug)
        self.assertEqual(p1.slug, 'unep')

        p2 = self._make_partner('UNEP')
        self.assertNotEqual(p1.slug, p2.slug)
        self.assertTrue(p2.slug.startswith('unep'))

    def test_link_partner_to_event_creates_event_partner_row(self):
        event = self._make_event('Test Event')
        partner = self._make_partner('Google')
        link = EventPartner.objects.create(
            event=event, partner=partner, role='partner', order=1
        )
        self.assertEqual(link.event, event)
        self.assertEqual(link.partner, partner)
        self.assertEqual(link.role, 'partner')
        self.assertEqual(event.event_partner_links.count(), 1)

    def test_duplicate_partner_link_is_rejected(self):
        event = self._make_event('Test Event')
        partner = self._make_partner('Google')
        EventPartner.objects.create(event=event, partner=partner)
        with self.assertRaises(Exception):
            EventPartner.objects.create(event=event, partner=partner)

    def test_deleting_event_does_not_delete_partner(self):
        event = self._make_event('Ephemeral')
        partner = self._make_partner('Persistent')
        EventPartner.objects.create(event=event, partner=partner)
        partner_id = partner.id
        event.delete()
        self.assertTrue(Partner.objects.filter(id=partner_id).exists())

    def test_deleting_partner_does_not_delete_event(self):
        event = self._make_event('Survivor')
        partner = self._make_partner('Disposable')
        EventPartner.objects.create(event=event, partner=partner)
        event_id = event.id
        partner.delete()
        self.assertTrue(Event.objects.filter(id=event_id).exists())

    def test_same_partner_can_be_reused_across_events(self):
        p = self._make_partner('UNEP')
        e1 = self._make_event('Event 1')
        e2 = self._make_event('Event 2')
        EventPartner.objects.create(event=e1, partner=p)
        EventPartner.objects.create(event=e2, partner=p)
        self.assertEqual(p.event_links.count(), 2)

    def test_partner_logo_data_migration_preserves_existing_records(self):
        """
        Verify that existing PartnerLogo rows are preserved after the
        data migration (no data loss).
        """
        # Simulate what the data migration does: create PartnerLogo
        # rows, then run the migration function on them.
        event = self._make_event('Migration Test Event')
        PartnerLogo.objects.create(
            event=event, name='Google', partner_logo='', order=1
        )
        PartnerLogo.objects.create(
            event=event, name='UNEP', partner_logo='', order=2
        )
        original_count = PartnerLogo.objects.count()
        self.assertEqual(original_count, 2)

        # Run the data migration logic manually
        import importlib
        migration_mod = importlib.import_module(
            'apps.event.migrations.0024_partner_eventpartner'
        )
        _migrate_partnerlogo_data = migration_mod._migrate_partnerlogo_data
        _reverse_partnerlogo_data = migration_mod._reverse_partnerlogo_data
        # Use no-op schema_editor
        class _NoopSchema:
            class connection:
                @staticmethod
                def cursor():
                    class _C:
                        def execute(self, *a, **kw): pass
                    return _C()

        from django.apps import apps as global_apps
        _migrate_partnerlogo_data(global_apps, _NoopSchema())

        # PartnerLogo data should still be intact
        self.assertEqual(PartnerLogo.objects.count(), original_count)

        # New Partner records should exist
        self.assertGreater(Partner.objects.count(), 0)
        partner_names = list(
            Partner.objects.values_list('name', flat=True)
        )
        self.assertIn('Google', partner_names)
        self.assertIn('UNEP', partner_names)

        # Cleanup
        _reverse_partnerlogo_data(global_apps, _NoopSchema())

    # ------------------------------------------------------------------
    # API tests
    # ------------------------------------------------------------------
    def _build_dummy_data(self):
        event = self._make_event('AirQo Clean Air Week 2026')
        google = self._make_partner('Google')
        unep = self._make_partner('UNEP')
        EventPartner.objects.bulk_create([
            EventPartner(event=event, partner=google, order=1, role='partner'),
            EventPartner(event=event, partner=unep, order=2, role='sponsor'),
        ])
        return event, [google, unep]

    def test_v2_event_detail_returns_partners(self):
        event, partners = self._build_dummy_data()
        cache.clear()
        request = self.factory.get(
            reverse('v2-events-detail', kwargs={'slug': event.slug}))
        response = V2EventViewSet.as_view(
            {'get': 'retrieve'})(request, slug=event.slug)
        self.assertEqual(response.status_code, 200)
        data = response.data

        self.assertIn('partners', data)
        self.assertEqual(len(data['partners']), 2)
        partner_names = [p['partner']['name'] for p in data['partners']]
        self.assertIn('Google', partner_names)
        self.assertIn('UNEP', partner_names)
        # Check role is exposed
        roles = [p['role'] for p in data['partners']]
        self.assertIn('partner', roles)
        self.assertIn('sponsor', roles)

    def test_v2_event_list_exposes_partners_count(self):
        event, partners = self._build_dummy_data()
        cache.clear()
        request = self.factory.get(reverse('v2-events-list'))
        response = V2EventViewSet.as_view({'get': 'list'})(request)
        self.assertEqual(response.status_code, 200)
        by_title = {item['title']: item for item in response.data['results']}
        main_item = by_title['AirQo Clean Air Week 2026']
        self.assertEqual(main_item['partners_count'], 2)

    def test_v2_partner_detail_endpoint_exposes_new_partner(self):
        p = self._make_partner('Test Partner')
        cache.clear()
        request = self.factory.get(
            reverse('v2-event-partners-detail', kwargs={'slug': p.slug}))
        response = V2PartnerViewSet.as_view(
            {'get': 'retrieve'})(request, slug=p.slug)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name'], 'Test Partner')
        self.assertEqual(response.data['slug'], p.slug)
        self.assertIn('logo_url', response.data)
        self.assertIn('website_url', response.data)

    def test_v2_event_list_still_works_without_partners(self):
        """Backward compat: events with no partners should still work."""
        self._make_event('Solo Event')
        cache.clear()
        request = self.factory.get(reverse('v2-events-list'))
        response = V2EventViewSet.as_view({'get': 'list'})(request)
        self.assertEqual(response.status_code, 200)
        item = next(
            i for i in response.data['results']
            if i['title'] == 'Solo Event'
        )
        self.assertEqual(item['partners_count'], 0)


class EventOrderingTests(TestCase):
    """Tests for the default event ordering logic."""

    def setUp(self):
        self.factory = APIRequestFactory()
        cache.clear()

    def _make_event(self, title, start_date, start_time=None, **kwargs):
        defaults = dict(
            title_subtext=f"{title} subtitle",
            order=1,
            start_date=start_date,
            start_time=start_time,
        )
        defaults.update(kwargs)
        return Event.objects.create(title=title, **defaults)

    def test_upcoming_events_appear_before_past_events(self):
        """Default list should show upcoming events first, then past."""
        today = date.today()
        self._make_event(
            'Past Event', today - timedelta(days=10))
        self._make_event(
            'Upcoming Near', today + timedelta(days=2))
        self._make_event(
            'Upcoming Far', today + timedelta(days=30))

        cache.clear()
        request = self.factory.get(reverse('v2-events-list'))
        response = V2EventViewSet.as_view({'get': 'list'})(request)
        self.assertEqual(response.status_code, 200)

        titles = [item['title'] for item in response.data['results']]
        # Upcoming events should appear before past events
        upcoming_idx = [i for i, t in enumerate(titles) if 'Upcoming' in t]
        past_idx = [i for i, t in enumerate(titles) if t == 'Past Event']
        self.assertTrue(
            max(upcoming_idx) < min(past_idx),
            f"Upcoming events {titles} should appear before past events"
        )

    def test_nearest_upcoming_event_first(self):
        """Among upcoming events, the nearest date should appear first."""
        today = date.today()
        self._make_event('Far Away', today + timedelta(days=60))
        self._make_event('Next Week', today + timedelta(days=7))
        self._make_event('Tomorrow', today + timedelta(days=1))

        cache.clear()
        request = self.factory.get(reverse('v2-events-list'))
        response = V2EventViewSet.as_view({'get': 'list'})(request)
        self.assertEqual(response.status_code, 200)

        titles = [item['title'] for item in response.data['results']]
        # Filter to only upcoming events
        upcoming = [t for t in titles if t in ('Tomorrow', 'Next Week', 'Far Away')]
        self.assertEqual(upcoming, ['Tomorrow', 'Next Week', 'Far Away'])

    def test_same_date_sorted_by_start_time(self):
        """Events on the same date should be sorted by start_time."""
        today = date.today()
        target = today + timedelta(days=5)
        self._make_event('Evening', target, start_time='18:00:00')
        self._make_event('Morning', target, start_time='09:00:00')
        self._make_event('Afternoon', target, start_time='14:00:00')

        cache.clear()
        request = self.factory.get(reverse('v2-events-list'))
        response = V2EventViewSet.as_view({'get': 'list'})(request)
        self.assertEqual(response.status_code, 200)

        titles = [item['title'] for item in response.data['results']]
        same_day = [t for t in titles if t in ('Morning', 'Afternoon', 'Evening')]
        self.assertEqual(same_day, ['Morning', 'Afternoon', 'Evening'])

    def test_same_date_same_time_falls_back_to_order(self):
        """Events with same date and time should sort by manual order."""
        today = date.today()
        target = today + timedelta(days=5)
        t = '10:00:00'
        self._make_event('Second', target, start_time=t, order=2)
        self._make_event('First', target, start_time=t, order=1)
        self._make_event('Third', target, start_time=t, order=3)

        cache.clear()
        request = self.factory.get(reverse('v2-events-list'))
        response = V2EventViewSet.as_view({'get': 'list'})(request)
        self.assertEqual(response.status_code, 200)

        titles = [item['title'] for item in response.data['results']]
        same = [t for t in titles if t in ('First', 'Second', 'Third')]
        self.assertEqual(same, ['First', 'Second', 'Third'])

    def test_client_can_override_ordering(self):
        """Client should be able to override default ordering with ?o=."""
        today = date.today()
        self._make_event('Event C', today + timedelta(days=3))
        self._make_event('Event A', today + timedelta(days=1))
        self._make_event('Event B', today + timedelta(days=2))

        cache.clear()
        request = self.factory.get(
            reverse('v2-events-list') + '?o=title')
        response = V2EventViewSet.as_view({'get': 'list'})(request)
        self.assertEqual(response.status_code, 200)

        titles = [item['title'] for item in response.data['results']]
        # Should be sorted alphabetically by title
        filtered = [t for t in titles if t.startswith('Event ')]
        self.assertEqual(filtered, ['Event A', 'Event B', 'Event C'])
