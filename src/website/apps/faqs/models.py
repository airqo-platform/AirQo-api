
from django.db import models
from django_quill.fields import QuillField


class FAQ(models.Model):
    CATEGORY_CHOICES = [
        ('general', 'General'),
        ('hardware', 'Hardware'),
        ('software', 'Software'),
    ]

    question = models.CharField(max_length=255)
    answer = QuillField(blank=True, default="")
    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        default='general',
        help_text="Category for the FAQ"
    )
    is_active = models.BooleanField(default=True)

    # Ordering field to allow manual rearrangement in the admin
    order = models.IntegerField(
        default=1000, help_text="Lower values appear first", db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("order", "-created_at")

    def __str__(self):
        return self.question
