# backend/utils/admin.py

from django import forms
from django.contrib import admin
from django.contrib.staticfiles import finders
from .forms import BaseQuillModelForm


class BaseQuillAdmin(admin.ModelAdmin):
    form = BaseQuillModelForm

    @property
    def media(self):
        media = super().media + forms.Media(
            css={'all': ('admin/css/custom_quill.css',)}
        )

        # Django versions use different filenames for admin theme scripts.
        for path in ('admin/js/theme.js', 'admin/js/admin_dark_mode.js'):
            if finders.find(path):
                media += forms.Media(js=(path,))
                break

        return media
