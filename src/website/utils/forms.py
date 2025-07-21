# backend/utils/forms.py

from django import forms
from django_quill.fields import QuillField
from .widgets import CustomQuillWidget


class BaseQuillModelForm(forms.ModelForm):
    class Meta:
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field_name, field in self.fields.items():
            if isinstance(self._meta.model._meta.get_field(field_name), QuillField):
                self.fields[field_name].widget = CustomQuillWidget(
                    config_name='default')
