from django.contrib import admin
import nested_admin
from .models import Department, Career, JobDescription, BulletDescription, BulletPoint


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')
    readonly_fields = ('id', )
    list_per_page = 10
    search_fields = ('id', 'name')


class JobDescriptionInline(nested_admin.NestedTabularInline):
    fields = ('description', 'order')
    model = JobDescription
    extra = 0


class BulletPointInline(nested_admin.NestedTabularInline):
    fields = ('point', 'order')
    model = BulletPoint
    extra = 0


class BulletDescriptionInline(nested_admin.NestedTabularInline):
    fields = ('name', 'order')
    model = BulletDescription
    inlines = (BulletPointInline,)
    extra = 0


@admin.register(Career)
class CareerAdmin(nested_admin.NestedModelAdmin):
    list_display = ('title', 'department', 'closing_date')
    readonly_fields = ('id', )
    fields = ('id', "title", "department", "type", "apply_url", "closing_date", )
    list_per_page = 10
    search_fields = ('title', 'department')
    list_filter = ('department', 'closing_date')
    inlines = (JobDescriptionInline, BulletDescriptionInline)
