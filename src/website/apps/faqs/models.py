
from django.db import models
from django_quill.fields import QuillField


class FAQ(models.Model):
    question = models.CharField(max_length=255)
    answer = QuillField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    # Ordering field to allow manual rearrangement in the admin
    order = models.IntegerField(
        default=1000, help_text="Lower values appear first")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("order", "-created_at")

    def __str__(self):
        return self.question
