
from rest_framework import serializers
from .models import FAQ
from utils.delta_to_html import delta_to_html
import json
import bleach


class FAQSerializer(serializers.ModelSerializer):
    # Custom field to convert Quill Delta to HTML
    answer = serializers.SerializerMethodField()
    # Provide rendered HTML explicitly for clients that want HTML output
    answer_html = serializers.SerializerMethodField()

    class Meta:
        model = FAQ
        fields = ['id', 'question', 'answer',
                  'is_active', 'created_at', 'updated_at', 'answer_html']

    def get_answer(self, obj):
        """Convert QuillField data to sanitized HTML"""
        # FieldQuill instances may not be JSON strings - prefer their .html property
        # If the field is empty or falsy, return empty string
        if not obj.answer:
            return ""

        try:
            # Handle QuillField content (JSON Delta format)
            answer_content = obj.answer

            # If it's a FieldQuill-like object, use its html property
            if hasattr(answer_content, 'html'):
                html_content = getattr(answer_content, 'html') or ''
            # If it's a string, check if it's JSON delta or plain HTML/text
            elif isinstance(answer_content, str):
                if answer_content.strip().startswith('{'):
                    # Convert Quill Delta to HTML
                    html_content = delta_to_html(answer_content)
                else:
                    # Treat as plain text/HTML
                    html_content = answer_content
            # If it's a dict or already a delta object
            else:
                html_content = delta_to_html(answer_content)

            # Sanitize HTML - allow links and basic formatting
            allowed_tags = [
                'p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li',
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'blockquote', 'code', 'pre', 'a'
            ]
            allowed_attributes = {
                '*': ['class'],
                'a': ['href', 'title'],
            }

            clean_html = bleach.clean(
                html_content,
                tags=allowed_tags,
                attributes=allowed_attributes,
                protocols={'http', 'https', 'mailto', 'tel'},
                strip=True,
                strip_comments=True,
            )
            return clean_html

        except (json.JSONDecodeError, TypeError, ValueError):
            # Fallback: treat as plain text and escape
            return bleach.clean(str(obj.answer), tags=[], strip=True)

    # Reuse the same conversion for answer_html (explicit HTML field)
    def get_answer_html(self, obj):
        return self.get_answer(obj)
