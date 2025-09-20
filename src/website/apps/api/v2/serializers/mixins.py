"""
Universal serializer mixins for slug-based API responses
"""
from rest_framework import serializers
from typing import Any, Dict, List, Optional, Union, TYPE_CHECKING, cast


class DynamicFieldsSerializerMixin:
    """
    Mixin that allows dynamic field inclusion/exclusion via query parameters
    """
    # Avoid declaring class-level attributes named `fields` or `context` which
    # shadow DRF's runtime properties and cause static type checker warnings.
    # For the static type checker (Pylance) only, declare the attributes in a
    # TYPE_CHECKING block below so type checkers know these exist on instances
    # without creating actual class-level attributes at runtime.

    # Do not declare class-level `context` or `fields` for static analysis here;
    # using runtime getattr checks keeps us compatible with DRF and avoids
    # conflicting type declarations across multiple mixins.

    def __init__(self, *args, **kwargs):
        # Don't pass the 'fields' arg up to the superclass
        fields = kwargs.pop('fields', None)
        omit = kwargs.pop('omit', None)

        # Instantiate the superclass normally
        super().__init__(*args, **kwargs)

        # Handle dynamic field selection from context (query params)
        request = None
        ctx = getattr(self, 'context', None)
        if ctx:
            request = ctx.get('request')
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
            existing = set(getattr(self, 'fields', {}))
            fields_map = getattr(self, 'fields', None)
            for field_name in existing - allowed:
                # Use pop with default to avoid KeyError when DRF implements fields lazily
                if fields_map is not None:
                    fields_map.pop(field_name, None)

        if omit is not None:
            # Remove fields specified in the `omit` argument
            fields_map = getattr(self, 'fields', None)
            for field_name in omit:
                if fields_map is not None:
                    fields_map.pop(field_name, None)


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
            ctx = getattr(self, 'context', None)
            if ctx and ctx.get('request') and ctx['request'].query_params.get('debug'):
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
        fields_map = getattr(self, 'fields', None)
        if fields_map is not None:
            if 'public_identifier' in fields_map:
                fields_map['public_identifier'].read_only = True
            if 'api_url' in fields_map:
                fields_map['api_url'].read_only = True
            if 'has_slug' in fields_map:
                fields_map['has_slug'].read_only = True


class ListSerializerMixin(ReadOnlySlugSerializerMixin):
    """
    Optimized mixin for list serializers - includes only essential fields
    """

    def to_representation(self, instance):
        """Optimized representation for list views"""
        data = super().to_representation(instance)  # type: ignore

        # For list views, we can add additional optimizations
        ctx = getattr(self, 'context', None)
        request = ctx.get('request') if ctx else None
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
        ctx = getattr(self, 'context', None)
        request = ctx.get('request') if ctx else None
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
            # Call parent `to_internal_value` dynamically to satisfy static
            # analysis tools that may not be able to see the method on `super()`.
            parent_method = getattr(super(), 'to_internal_value', None)
            if parent_method:
                return [parent_method(item) for item in data]
            # Fallback: attempt to call Serializer.to_internal_value via cast
            serializer_self = cast(serializers.Serializer, self)
            return [serializer_self.to_internal_value(item) for item in data]
        parent_method = getattr(super(), 'to_internal_value', None)
        if parent_method:
            return parent_method(data)
        serializer_self = cast(serializers.Serializer, self)
        return serializer_self.to_internal_value(data)

    def create(self, validated_data) -> Union[Any, List[Any]]:
        """Handle bulk creation"""
        if isinstance(validated_data, list):
            return [self.Meta.model.objects.create(**item) for item in validated_data]
        parent_create = getattr(super(), 'create', None)
        if parent_create:
            return parent_create(validated_data)
        # Fallback to model creation if base serializer doesn't implement create
        return self.Meta.model.objects.create(**validated_data)


# Note: Convenience base classes removed due to multiple inheritance complexity
# Use mixins directly: class MySerializer(ListSerializerMixin, serializers.ModelSerializer)
