
from django.db import models
from django_quill.fields import QuillField


class FAQ(models.Model):
    question = models.CharField(max_length=255)
    answer = QuillField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.question
