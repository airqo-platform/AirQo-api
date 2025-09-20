# faqs/admin.py
from django.contrib import admin
from utils.admin import BaseQuillAdmin
from .models import FAQ


@admin.register(FAQ)
class FAQAdmin(BaseQuillAdmin):
    list_display = ('order', 'question', 'is_active',
                    'created_at', 'updated_at')
    list_editable = ('order', 'is_active')
    list_display_links = ('question',)

    list_filter = ('is_active', 'created_at')
    search_fields = ('question', 'answer')
    ordering = ('order', '-created_at')
