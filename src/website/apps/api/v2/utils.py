"""
Utility functions and classes for v2 API
"""
from typing import Any, Dict, List, Optional, Union
from rest_framework import serializers
from rest_framework.fields import empty
from utils.delta_to_html import delta_to_html
import json
import bleach


class DynamicFieldsSerializerMixin:
    """
    A serializer mixin that takes additional `fields` and `omit` arguments to
    control which fields should be displayed.
    """

    # Note: DRF's Serializer provides `fields` as a runtime cached_property.
    # We intentionally do not statically declare it here to avoid creating
    # an incompatible override with DRF's base class.

    def __init__(self, *args, **kwargs):
        # Extract fields/omit parameters from context if present
        context = kwargs.get('context', {})
        request = context.get('request')
        fields_param = None
        omit_param = None

        if request:
            fields_param = request.query_params.get('fields')
            omit_param = request.query_params.get('omit')

        # Extract fields/omit from kwargs (direct instantiation)
        fields_param = kwargs.pop('fields', fields_param)
        omit_param = kwargs.pop('omit', omit_param)

        super().__init__(*args, **kwargs)

        # Only apply field filtering if we have actual fields to work with.
        # Use getattr to avoid static typing issues with DRF's cached_property.
        fields_map = getattr(self, 'fields', None)
        if fields_map:
            if fields_param is not None:
                selected = fields_param.split(',') if isinstance(
                    fields_param, str) else fields_param
                # Drop any fields that are not specified in the `fields` argument.
                allowed = set(selected)
                existing = set(fields_map)
                for field_name in existing - allowed:
                    fields_map.pop(field_name, None)

            if omit_param is not None:
                omit_list = omit_param.split(',') if isinstance(
                    omit_param, str) else omit_param
                # Drop any fields that are specified in the `omit` argument.
                for field_name in omit_list:
                    fields_map.pop(field_name, None)


class SanitizedHTMLField(serializers.CharField):
    """
    A serializer field that sanitizes HTML content using bleach.
    Only allows safe HTML tags and attributes.
    """

    ALLOWED_TAGS = [
        'p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'code', 'pre', 'a'  # Added 'a' tag for links
    ]

    ALLOWED_ATTRIBUTES = {
        '*': ['class'],
        'a': ['href', 'title'],
        'img': ['src', 'alt', 'width', 'height'],
    }

    def __init__(self, allowed_tags=None, allowed_attributes=None, **kwargs):
        self.allowed_tags = allowed_tags or self.ALLOWED_TAGS
        self.allowed_attributes = allowed_attributes or self.ALLOWED_ATTRIBUTES
        super().__init__(**kwargs)

    def to_representation(self, value) -> Any:
        """Convert QuillField data to sanitized HTML for API output"""
        if not value:
            return ""

        # Handle QuillField content (JSON Delta format)
        try:
            # If this is a FieldQuill-like object (from django_quill), prefer its html
            if hasattr(value, 'html'):
                html_content = getattr(value, 'html') or ''
            # If value is a string, try to parse as JSON (Quill Delta) or treat as HTML
            elif isinstance(value, str):
                if value.strip().startswith('{'):
                    html_content = delta_to_html(value)
                else:
                    html_content = value
            else:
                # Handle dict/object (already parsed Delta)
                html_content = delta_to_html(value)

            # Sanitize the HTML content
            clean_html = bleach.clean(
                html_content,
                tags=self.allowed_tags,
                attributes=self.allowed_attributes,
                strip=True,
            )
            return clean_html

        except (json.JSONDecodeError, TypeError, ValueError):
            # Fallback: treat as plain text and escape
            return bleach.clean(str(value), tags=[], strip=True)

    def to_internal_value(self, data) -> Any:
        """Sanitize HTML when receiving data"""
        if data is empty:
            return data

        # Convert to string if needed
        data = str(data)

        # Sanitize HTML using bleach (handles tricky end-tags and proper parsing)
        clean_data = bleach.clean(
            data,
            tags=self.allowed_tags,
            attributes=self.allowed_attributes,
            strip=True,
        )

        return super().to_internal_value(clean_data)


def get_client_ip(request):
    """
    Get the client's IP address from the request.
    Handles cases where request is behind a proxy.
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def build_absolute_uri(request, relative_url):
    """
    Build an absolute URI from a relative URL using the request.
    """
    if not relative_url:
        return None
    return request.build_absolute_uri(relative_url)


class OptimizedQuerySetMixin:
    """
    Mixin for ViewSets that provides optimized queryset methods
    with select_related and prefetch_related for common patterns.
    """
    select_related_fields: Optional[List[str]] = None
    prefetch_related_fields: Optional[List[str]] = None
    list_only_fields: Optional[List[str]] = None
    action: str

    def get_queryset(self):
        """
        Override this method in viewsets to provide optimized querysets.
        """
        # This will be called from ViewSet which has get_queryset
        queryset = super().get_queryset()  # type: ignore

        # Apply optimizations if defined
        if hasattr(self, 'select_related_fields') and self.select_related_fields:
            queryset = queryset.select_related(*self.select_related_fields)

        if hasattr(self, 'prefetch_related_fields') and self.prefetch_related_fields:
            queryset = queryset.prefetch_related(*self.prefetch_related_fields)

        # For list views, only select needed fields to reduce query size
        if hasattr(self, 'action') and self.action == 'list' and hasattr(self, 'list_only_fields') and self.list_only_fields:
            queryset = queryset.only(*self.list_only_fields)

        return queryset
