from django.db import models
from utils.models import BaseModel, SlugBaseModel
from django.db.models.signals import pre_save
from django.dispatch import receiver


class Department(BaseModel):
    name = models.CharField(max_length=30, null=False, blank=False)

    def __str__(self):
        return f"{self.name} Department"


class Career(SlugBaseModel):
    class JobTypes(models.TextChoices):
        FullTime = "full-time", "Full Time"
        PartTime = "part-time", "Part Time"
        Contract = "contract", "Contract"
        Temporary = "temporary", "Temporary"
        Internship = "internship", "Internship"
        GraduateTraining = "graduate-training", "Graduate Training"

    # Slug configuration
    SLUG_SOURCE_FIELD = 'title'
    SLUG_USE_DATE = False  # Jobs typically don't need year
    SLUG_USE_LOCATION = False
    SLUG_MAX_LENGTH = 70

    title = models.CharField(max_length=100)
    unique_title = models.CharField(max_length=100, null=True, blank=True)
    closing_date = models.DateTimeField()
    apply_url = models.URLField(max_length=250)
    type = models.CharField(
        max_length=30, default=JobTypes.FullTime, choices=JobTypes.choices
    )
    department = models.ForeignKey(
        Department,
        null=True,
        blank=True,
        related_name="careers",
        on_delete=models.SET_NULL,
    )

    def generate_unique_title(self, postfix_index=0):
        from django.utils.text import slugify

        unique_title = slugify(self.title)
        if postfix_index > 0:
            unique_title = f"{unique_title}{postfix_index}"
        if not Career.objects.filter(unique_title=unique_title).exists():
            return unique_title
        return self.generate_unique_title(postfix_index + 1)

    def __str__(self):
        return f"Job - {self.title}"


@receiver(pre_save, sender=Career)
def append_short_name(sender, instance, *args, **kwargs):
    if not instance.unique_title:
        instance.unique_title = instance.generate_unique_title()


class JobDescription(BaseModel):
    description = models.TextField()
    order = models.IntegerField(default=1)
    career = models.ForeignKey(
        'Career',
        null=True,
        blank=True,
        related_name="descriptions",
        on_delete=models.SET_NULL,
    )

    class Meta(BaseModel.Meta):
        ordering = ['order']

    def __str__(self):
        instance_id = getattr(self, 'id', None)
        return f"JobDescription {instance_id}" if instance_id else "JobDescription"


class BulletDescription(BaseModel):
    name = models.CharField(max_length=30)
    order = models.IntegerField(default=1)
    career = models.ForeignKey(
        'Career',
        null=True,
        blank=True,
        related_name="bullets",
        on_delete=models.SET_NULL,
    )

    class Meta(BaseModel.Meta):
        ordering = ['order']

    def __str__(self):
        return f"Bullet - {self.name}"


class BulletPoint(BaseModel):
    point = models.TextField()
    order = models.IntegerField(default=1)
    bullet = models.ForeignKey(
        BulletDescription,
        null=True,
        blank=True,
        related_name="bullet_points",
        on_delete=models.SET_NULL,
    )

    class Meta(BaseModel.Meta):
        ordering = ['order']

    def __str__(self):
        instance_id = getattr(self, 'id', None)
        return f"BulletPoint - {instance_id}" if instance_id else "BulletPoint"
