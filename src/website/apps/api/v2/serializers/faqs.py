"""
FAQs app serializers for v2 API
"""
from rest_framework import serializers
from apps.faqs.models import FAQ
from ..utils import DynamicFieldsSerializerMixin, SanitizedHTMLField


class FAQListSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """
    List serializer for FAQ - includes basic fields for listing
    """
    # Sanitize HTML content in the answer field
    answer = SanitizedHTMLField(read_only=True)
    # Explicit rendered HTML convenience field
    answer_html = SanitizedHTMLField(source='answer', read_only=True)

    class Meta:
        model = FAQ
        fields = [
            'id',
            'question',
            'answer',
            'answer_html',
            'category',
            'is_active',
            'created_at',
            'updated_at',
        ]
    ref_name = 'FAQListV2'


class FAQDetailSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """
    Detail serializer for FAQ - includes all fields
    """
    # Sanitize HTML content in the answer field
    answer = SanitizedHTMLField(read_only=True)
    # Explicit rendered HTML convenience field
    answer_html = SanitizedHTMLField(source='answer', read_only=True)

    class Meta:
        model = FAQ
        fields = [
            'id',
            'question',
            'answer',
            'answer_html',
            'category',
            'is_active',
            'created_at',
            'updated_at',
        ]
    ref_name = 'FAQDetailV2'
