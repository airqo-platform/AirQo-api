# backend/utils/admin.py

from django.contrib import admin
from .forms import BaseQuillModelForm


class BaseQuillAdmin(admin.ModelAdmin):
    form = BaseQuillModelForm

    class Media:
        css = {
            'all': ('admin/css/custom_quill.css',),
        }
        js = ('admin/js/admin_dark_mode.js',)
