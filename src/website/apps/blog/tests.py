import json
from datetime import date
from importlib import import_module

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIRequestFactory

from apps.blog.models import BlogPost
from apps.blog.views import BlogPostViewSet
from apps.event.models import Event
from apps.event.views import EventViewSet

V2BlogPostViewSet = import_module('apps.api.v2.viewsets.blogs').BlogPostViewSet


class BlogApiTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

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
        payload = response.data
        self.assertEqual([item['title'] for item in payload], ['First post', 'Second post'])
        self.assertEqual([item['order'] for item in payload], [1, 2])
        self.assertEqual(payload[0]['author_role'], 'Editor')
        self.assertEqual(payload[0]['meta_title'], 'First post SEO title')
        self.assertEqual(payload[0]['meta_description'], 'First post SEO description')

    def test_v2_blog_list_exposes_new_fields(self):
        BlogPost.objects.create(
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
        self.assertEqual(payload[0]['author_role'], 'Lead Writer')
        self.assertEqual(payload[0]['meta_title'], 'V2 meta title')
        self.assertEqual(payload[0]['meta_description'], 'V2 meta description')


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