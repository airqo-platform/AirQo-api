
from django.db import models
from django_quill.fields import QuillField


class Category(models.Model):
    # This table predates the project-wide BigAutoField default. Keep the
    # existing primary-key type explicit so migration reconciliation does not
    # attempt an unnecessary production type change.
    id = models.AutoField(
        auto_created=True,
        primary_key=True,
        serialize=False,
        verbose_name="ID",
    )
    name = models.CharField(max_length=50, unique=True)

    class Meta:
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name


def get_default_category():
    """Get the default category (General), creating it if it doesn't exist."""
    category, created = Category.objects.get_or_create(name='General')
    return category.id  # type: ignore


class FAQ(models.Model):
    question = models.CharField(max_length=255)
    answer = QuillField(blank=True, default="")
    category = models.ForeignKey(Category, on_delete=models.CASCADE, default=get_default_category)  # type: ignore
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
