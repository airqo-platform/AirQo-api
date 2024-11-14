from django.contrib import admin
import nested_admin
from .models import AfricanCountry, City, Content, Image, Description


class ImageInline(nested_admin.NestedTabularInline):
    fields = ('image', 'order')
    model = Image
    extra = 0


class DescriptionInline(nested_admin.NestedTabularInline):
    fields = ('paragraph', 'order')
    model = Description
    extra = 0


class ContentInline(nested_admin.NestedStackedInline):
    fields = ('title', 'order')
    model = Content
    extra = 0
    inlines = (DescriptionInline, ImageInline,)


class CityInline(nested_admin.NestedTabularInline):
    fields = ('city_name', 'order')
    model = City
    extra = 0
    inlines = (ContentInline,)


@admin.register(AfricanCountry)
class AfricanCitiesAdmin(nested_admin.NestedModelAdmin):
    fields = ('country_name', 'country_flag', 'order')
    readonly_fields = ('id',)
    list_display = ('country_name', 'flag_preview', 'order')
    search_fields = ('country_name',)
    list_editable = ('order',)
    inlines = (CityInline,)
    list_per_page = 10

    def flag_preview(self, obj):
        width, height = 60, 40
        from django.utils.html import format_html

        flag_url = obj.get_country_flag_url()
        if flag_url:
            return format_html(f'<img src="{flag_url}" width="{width}" height="{height}" />')
        return '-'
