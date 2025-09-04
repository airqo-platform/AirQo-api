# backend/utils/widgets.py

from django_quill.widgets import QuillWidget


class CustomQuillWidget(QuillWidget):
    template_name = 'django_quill/editor.html'

    def __init__(self, *args, **kwargs):
        config_name = kwargs.pop('config_name', 'default')
        super().__init__(*args, config_name=config_name, **kwargs)
