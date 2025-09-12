"""
drf-spectacular schema extensions for v2 API

Provides custom schema generation and documentation enhancements.
"""
from typing import Any, Optional
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiExample
from drf_spectacular.types import OpenApiTypes


# Dynamic field parameters for documentation
DYNAMIC_FIELD_PARAMETERS = [
    OpenApiParameter(
        name='fields',
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        description='Comma-separated list of fields to include in the response',
        examples=[
            OpenApiExample('Basic fields', value='id,title,created'),
            OpenApiExample('Related fields', value='id,title,author__name'),
        ]
    ),
    OpenApiParameter(
        name='omit',
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        description='Comma-separated list of fields to exclude from the response',
        examples=[
            OpenApiExample('Exclude metadata',
                           value='created,modified,author'),
            OpenApiExample('Exclude large fields',
                           value='content,description'),
        ]
    ),
]


# Common schema decorators for viewsets
def standard_list_schema(**kwargs):
    """Standard schema decorator for list endpoints"""
    parameters = [
        OpenApiParameter(
            name='page',
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            description='Page number for pagination'
        ),
        OpenApiParameter(
            name='page_size',
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            description='Number of results per page (max: 100)'
        ),
        OpenApiParameter(
            name='ordering',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            description='Fields to order by. Prefix with - for descending order',
            examples=[
                OpenApiExample('Order by creation date', value='-created'),
                OpenApiExample('Order by title', value='title'),
            ]
        ),
        OpenApiParameter(
            name='search',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            description='Search term for text fields'
        ),
    ] + DYNAMIC_FIELD_PARAMETERS

    # Add any additional parameters from kwargs
    if 'parameters' in kwargs:
        parameters.extend(kwargs['parameters'])
        del kwargs['parameters']

    return extend_schema(
        parameters=parameters,
        **kwargs
    )


def standard_retrieve_schema(**kwargs):
    """Standard schema decorator for retrieve endpoints"""
    parameters = DYNAMIC_FIELD_PARAMETERS

    # Add any additional parameters from kwargs
    if 'parameters' in kwargs:
        parameters.extend(kwargs['parameters'])
        del kwargs['parameters']

    return extend_schema(
        parameters=parameters,
        **kwargs
    )


def featured_list_schema(**kwargs):
    """Schema decorator for endpoints that support featured filtering"""
    return extend_schema(
        parameters=[
            OpenApiParameter(
                name='featured',
                type=OpenApiTypes.BOOL,
                location=OpenApiParameter.QUERY,
                description='Filter by featured items only'
            ),
        ],
        **kwargs
    )


def date_range_schema(**kwargs):
    """Schema decorator for endpoints that support date range filtering"""
    return extend_schema(
        parameters=[
            OpenApiParameter(
                name='start_date',
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description='Filter items from this date (YYYY-MM-DD)'
            ),
            OpenApiParameter(
                name='end_date',
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description='Filter items until this date (YYYY-MM-DD)'
            ),
            OpenApiParameter(
                name='date_range',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='Predefined date range filter',
                examples=[
                    OpenApiExample('This year', value='this_year'),
                    OpenApiExample('Last 30 days', value='last_30_days'),
                    OpenApiExample('Upcoming', value='upcoming'),
                ]
            ),
        ],
        **kwargs
    )


def category_filter_schema(category_param='category', **kwargs):
    """Schema decorator for endpoints that support category filtering"""
    return extend_schema(
        parameters=[
            OpenApiParameter(
                name=category_param,
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description='Filter by category'
            ),
        ],
        **kwargs
    )
