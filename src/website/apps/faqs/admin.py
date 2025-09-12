# faqs/admin.py
from django.contrib import admin
from utils.admin import BaseQuillAdmin
from .models import FAQ


@admin.register(FAQ)
class FAQAdmin(BaseQuillAdmin):
    list_display = ('question', 'is_active', 'created_at', 'updated_at')

    list_filter = ('is_active', 'created_at')
    search_fields = ('question', 'answer')
