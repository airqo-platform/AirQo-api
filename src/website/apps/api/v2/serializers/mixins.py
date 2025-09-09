"""
Universal serializer mixins for slug-based API responses
"""
from rest_framework import serializers
from typing import Any, Dict, List, Optional, Union


class DynamicFieldsSerializerMixin:
    """
    Mixin that allows dynamic field inclusion/exclusion via query parameters
    """
    # Type annotations for Django REST Framework attributes
    fields: Dict[str, Any]  # type: ignore
    context: Dict[str, Any]  # type: ignore

    def __init__(self, *args, **kwargs):
        # Don't pass the 'fields' arg up to the superclass
        fields = kwargs.pop('fields', None)
        omit = kwargs.pop('omit', None)

        # Instantiate the superclass normally
        super().__init__(*args, **kwargs)

        # Handle dynamic field selection from context (query params)
        if hasattr(self, 'context') and self.context:
            request = self.context.get('request')
            if request:
                query_fields = request.query_params.get('fields')
                query_omit = request.query_params.get('omit')

                if query_fields:
                    fields = query_fields.split(',')
                if query_omit:
                    omit = query_omit.split(',')

        if fields is not None:
            # Drop any fields that are not specified in the `fields` argument
            allowed = set(fields)
            existing = set(self.fields)
            for field_name in existing - allowed:
                self.fields.pop(field_name)

        if omit is not None:
            # Remove fields specified in the `omit` argument
            for field_name in omit:
                self.fields.pop(field_name, None)


class SlugSerializerMixin(DynamicFieldsSerializerMixin):
    """
    Mixin that automatically handles ID field visibility based on slug existence
    and adds slug-related fields for privacy-friendly URLs
    """
    # Type annotations for Django REST Framework attributes
    Meta: Any  # type: ignore

    def get_field_names(self, declared_fields, info):
        """Override to add slug fields dynamically"""
        fields = super().get_field_names(declared_fields, info)  # type: ignore

        # Add slug fields if model supports them
        if hasattr(self.Meta.model, 'slug'):
            # Convert to list if it's not already
            if isinstance(fields, tuple):
                fields = list(fields)

            # Add slug-related fields
            slug_fields = ['public_identifier', 'api_url', 'has_slug']
            for field in slug_fields:
                if field not in fields:
                    fields.append(field)

        return fields

    def get_fields(self):
        """Override to add SerializerMethodFields for slug functionality"""
        fields = super().get_fields()  # type: ignore

        # Add slug fields as SerializerMethodFields if model supports slugs
        if hasattr(self.Meta.model, 'slug'):
            fields['public_identifier'] = serializers.SerializerMethodField()
            fields['api_url'] = serializers.SerializerMethodField()
            fields['has_slug'] = serializers.SerializerMethodField()

        return fields

    def to_representation(self, instance):
        """Override to conditionally include/exclude ID field for privacy"""
        data = super().to_representation(instance)  # type: ignore

        # Privacy enhancement: Remove ID if slug exists and is the preferred identifier
        if hasattr(instance, 'has_slug') and instance.has_slug:
            # Remove ID from public API response
            data.pop('id', None)

            # Add note about privacy-friendly access
            if self.context.get('request') and self.context['request'].query_params.get('debug'):
                data['_privacy_note'] = 'ID hidden - use public_identifier for references'

        return data

    def get_public_identifier(self, obj):
        """Get the public identifier (slug or fallback)"""
        if hasattr(obj, 'get_public_identifier'):
            return obj.get_public_identifier()
        elif hasattr(obj, 'slug') and obj.slug:
            return obj.slug
        else:
            return str(obj.id)

    def get_api_url(self, obj):
        """Get the API URL for the object"""
        if hasattr(obj, 'get_absolute_url'):
            return obj.get_absolute_url()

        # Fallback: construct URL manually
        model_name = obj.__class__.__name__.lower()
        plural_name = f"{model_name}s" if not model_name.endswith(
            's') else model_name
        identifier = obj.slug if hasattr(obj, 'slug') and obj.slug else obj.id
        return f"/website/api/v2/{plural_name}/{identifier}/"

    def get_has_slug(self, obj):
        """Check if object has a slug"""
        return hasattr(obj, 'has_slug') and obj.has_slug


class ReadOnlySlugSerializerMixin(SlugSerializerMixin):
    """
    Read-only version of SlugSerializerMixin for list/detail serializers
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # Make slug fields read-only
        if hasattr(self, 'fields'):
            if 'public_identifier' in self.fields:
                self.fields['public_identifier'].read_only = True
            if 'api_url' in self.fields:
                self.fields['api_url'].read_only = True
            if 'has_slug' in self.fields:
                self.fields['has_slug'].read_only = True


class ListSerializerMixin(ReadOnlySlugSerializerMixin):
    """
    Optimized mixin for list serializers - includes only essential fields
    """

    def to_representation(self, instance):
        """Optimized representation for list views"""
        data = super().to_representation(instance)  # type: ignore

        # For list views, we can add additional optimizations
        request = self.context.get('request') if hasattr(self, 'context') else None
        if request and request.query_params.get('minimal'):
            # Ultra-minimal response for performance
            essential_fields = ['public_identifier', 'api_url']
            if hasattr(instance, 'title'):
                essential_fields.append('title')
            elif hasattr(instance, 'name'):
                essential_fields.append('name')

            # Keep only essential fields
            data = {k: v for k, v in data.items() if k in essential_fields}

        return data


class DetailSerializerMixin(ReadOnlySlugSerializerMixin):
    """
    Enhanced mixin for detail serializers - includes full object data
    """

    def to_representation(self, instance):
        """Enhanced representation for detail views"""
        data = super().to_representation(instance)  # type: ignore

        # Add metadata for detail views
        request = self.context.get('request') if hasattr(self, 'context') else None
        if request and request.query_params.get('include_meta'):
            data['_meta'] = {
                'model': instance.__class__.__name__,
                'created': instance.created.isoformat() if hasattr(instance, 'created') else None,
                'modified': instance.modified.isoformat() if hasattr(instance, 'modified') else None,
                'slug_generated': hasattr(instance, 'slug') and bool(instance.slug),
            }

        return data


class BulkSerializerMixin:
    """
    Mixin for handling bulk operations while maintaining slug functionality
    """
    # Type annotations for Django REST Framework attributes
    Meta: Any  # type: ignore

    def to_internal_value(self, data) -> Union[Dict[str, Any], List[Dict[str, Any]]]:
        """Handle bulk data processing"""
        if isinstance(data, list):
            # Bulk operation
            return [super().to_internal_value(item) for item in data]  # type: ignore
        return super().to_internal_value(data)  # type: ignore

    def create(self, validated_data) -> Union[Any, List[Any]]:
        """Handle bulk creation"""
        if isinstance(validated_data, list):
            return [self.Meta.model.objects.create(**item) for item in validated_data]
        return super().create(validated_data)  # type: ignore


# Note: Convenience base classes removed due to multiple inheritance complexity
# Use mixins directly: class MySerializer(ListSerializerMixin, serializers.ModelSerializer)
