"""
FAQs app serializers for v2 API
"""
from rest_framework import serializers
from apps.faqs.models import FAQ, Category
from ..utils import DynamicFieldsSerializerMixin, SanitizedHTMLField


class CategorySerializer(serializers.ModelSerializer):
    """
    Serializer for Category
    """
    class Meta:
        model = Category
        fields = ['id', 'name']


class FAQListSerializer(DynamicFieldsSerializerMixin, serializers.ModelSerializer):
    """
    List serializer for FAQ - includes basic fields for listing
    """
    # Sanitize HTML content in the answer field
    answer = SanitizedHTMLField(read_only=True)
    # Explicit rendered HTML convenience field
    answer_html = SanitizedHTMLField(source='answer', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = FAQ
        fields = [
            'id',
            'question',
            'answer',
            'answer_html',
            'category',
            'category_name',
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
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = FAQ
        fields = [
            'id',
            'question',
            'answer',
            'answer_html',
            'category',
            'category_name',
            'is_active',
            'created_at',
            'updated_at',
        ]
    ref_name = 'FAQDetailV2'
