"""
Universal mixins for slug-based lookup across all V2 endpoints
"""
from typing import Any, List, Optional, Dict
from django.shortcuts import get_object_or_404
from django.db.models import Q, QuerySet
from django.http import Http404
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from rest_framework.viewsets import ModelViewSet


class SlugModelViewSetMixin:
    """
    Universal mixin for slug-based lookup across all viewsets.
    Provides backward compatibility with ID-based lookup while prioritizing slugs.
    
    This mixin should be used with ModelViewSet classes.
    """
    lookup_field = 'slug'  # Default to slug lookup
    lookup_url_kwarg = 'slug'
    slug_filter_fields = ['slug']  # Fields to search for slugs
    
    # Type annotations for attributes that will be provided by ModelViewSet
    kwargs: Dict[str, Any]
    
    def get_object(self) -> Any:
        """
        Override to support both ID and slug lookup with intelligent detection
        """
        lookup_value = self.kwargs.get(self.lookup_url_kwarg)
        
        if not lookup_value:
            # Fallback to default behavior if no lookup value
            return super().get_object()  # type: ignore
        
        # Strategy 1: If it's a digit, try ID first (backward compatibility)
        if lookup_value.isdigit():
            try:
                return self.get_queryset().get(pk=int(lookup_value))  # type: ignore
            except self.get_queryset().model.DoesNotExist:  # type: ignore
                pass
        
        # Strategy 2: Try slug lookup (primary method)
        filter_q = Q()
        for field in self.slug_filter_fields:
            if hasattr(self.get_queryset().model, field):  # type: ignore
                filter_q |= Q(**{field: lookup_value})
        
        if filter_q:
            try:
                return self.get_queryset().get(filter_q)  # type: ignore
            except self.get_queryset().model.DoesNotExist:  # type: ignore
                pass
        
        # Strategy 3: If model has custom identifier fields, try them
        if hasattr(self.get_queryset().model, 'unique_title'):  # type: ignore
            try:
                return self.get_queryset().get(unique_title=lookup_value)  # type: ignore
            except self.get_queryset().model.DoesNotExist:  # type: ignore
                pass
        
        # If all strategies fail, raise 404
        raise Http404(
            f"{self.get_queryset().model.__name__} not found with identifier: {lookup_value}"  # type: ignore
        )
    
    @action(detail=False, methods=['get'], url_path='by-slug/(?P<slug>[-\\w]+)')
    def by_slug(self, request: Any, slug: Optional[str] = None) -> Response:
        """Explicit slug lookup endpoint for guaranteed slug-based access"""
        if not slug:
            return Response(
                {'error': 'Slug parameter is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Build filter query for slug fields
        filter_q = Q()
        for field in self.slug_filter_fields:
            if hasattr(self.get_queryset().model, field):  # type: ignore
                filter_q |= Q(**{field: slug})
        
        if not filter_q:
            return Response(
                {'error': 'Model does not support slug lookup'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            obj = self.get_queryset().get(filter_q)  # type: ignore
        except self.get_queryset().model.DoesNotExist:  # type: ignore
            return Response(
                {'error': f'Object not found with slug: {slug}'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = self.get_serializer(obj)  # type: ignore
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], url_path='identifiers')
    def get_identifiers(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """Get all available identifiers for the object"""
        obj = self.get_object()  # type: ignore
        model_name = obj.__class__.__name__.lower()
        
        # Build identifier data
        data = {
            'model': model_name,
            'primary_identifier': obj.get_public_identifier() if hasattr(obj, 'get_public_identifier') else str(getattr(obj, 'id', 'unknown')),
            'slug': getattr(obj, 'slug', None),
            'has_slug': getattr(obj, 'has_slug', False) if hasattr(obj, 'has_slug') else bool(getattr(obj, 'slug', None)),
            'api_url': obj.get_absolute_url() if hasattr(obj, 'get_absolute_url') else None,
        }
        
        # Build lookup methods array
        lookup_methods = []
        
        # ID-based lookup (always available for backward compatibility)
        plural_name = f"{model_name}s" if not model_name.endswith('s') else model_name
        obj_id = getattr(obj, 'id', None)
        if obj_id:
            lookup_methods.append({
                'method': 'id',
                'url': f"/website/api/v2/{plural_name}/{obj_id}/",
                'description': 'Numeric ID lookup (legacy)'
            })
        
        # Slug-based lookup (if available)
        obj_slug = getattr(obj, 'slug', None)
        if obj_slug:
            lookup_methods.append({
                'method': 'slug',
                'url': f"/website/api/v2/{plural_name}/{obj_slug}/",
                'description': 'Slug-based lookup (preferred)'
            })
        
        # Custom identifier lookup (if available)
        obj_unique_title = getattr(obj, 'unique_title', None)
        if obj_unique_title:
            lookup_methods.append({
                'method': 'unique_title',
                'url': f"/website/api/v2/{plural_name}/{obj_unique_title}/",
                'description': 'Custom unique title lookup'
            })
        
        data['lookup_methods'] = lookup_methods
        
        # Privacy note: Remove ID from public response if slug exists and is preferred
        obj_has_slug = getattr(obj, 'has_slug', False) if hasattr(obj, 'has_slug') else bool(getattr(obj, 'slug', None))
        if obj_has_slug:
            data['note'] = 'ID hidden for privacy - use slug for public references'
        
        return Response(data)
    
    @action(detail=False, methods=['post'], url_path='bulk-identifiers')
    def bulk_identifiers(self, request: Any) -> Response:
        """Get identifiers for multiple objects by their slugs or IDs"""
        identifiers = request.data.get('identifiers', [])
        
        if not identifiers or not isinstance(identifiers, list):
            return Response(
                {'error': 'identifiers array is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        results = []
        for identifier in identifiers[:50]:  # Limit to 50 for performance
            try:
                # Try to find object by identifier
                filter_q = Q(pk=identifier) if str(identifier).isdigit() else Q()
                
                # Add slug filters
                for field in self.slug_filter_fields:
                    if hasattr(self.get_queryset().model, field):  # type: ignore
                        filter_q |= Q(**{field: identifier})
                
                if hasattr(self.get_queryset().model, 'unique_title'):  # type: ignore
                    filter_q |= Q(unique_title=identifier)
                
                obj = self.get_queryset().get(filter_q)  # type: ignore
                
                results.append({
                    'input': identifier,
                    'found': True,
                    'slug': getattr(obj, 'slug', None),
                    'public_identifier': obj.get_public_identifier() if hasattr(obj, 'get_public_identifier') else str(getattr(obj, 'id', 'unknown')),
                    'api_url': obj.get_absolute_url() if hasattr(obj, 'get_absolute_url') else None,
                })
                
            except self.get_queryset().model.DoesNotExist:  # type: ignore
                results.append({
                    'input': identifier,
                    'found': False,
                    'error': 'Not found'
                })
        
        return Response({
            'results': results,
            'total_requested': len(identifiers),
            'total_found': len([r for r in results if r['found']]),
        })


class OptimizedQuerySetMixin:
    """
    Mixin to ensure optimized querysets with proper select_related/prefetch_related
    
    This mixin should be used with ModelViewSet classes.
    """
    
    # Type annotations for attributes that will be provided by child classes
    select_related_fields: Optional[List[str]] = None
    prefetch_related_fields: Optional[List[str]] = None
    
    def get_queryset(self) -> QuerySet:
        """Override to apply optimizations"""
        queryset = super().get_queryset()  # type: ignore
        
        # Apply select_related for foreign keys if defined
        if hasattr(self, 'select_related_fields') and self.select_related_fields:
            queryset = queryset.select_related(*self.select_related_fields)
        
        # Apply prefetch_related for many-to-many if defined
        if hasattr(self, 'prefetch_related_fields') and self.prefetch_related_fields:
            queryset = queryset.prefetch_related(*self.prefetch_related_fields)
        
        return queryset
