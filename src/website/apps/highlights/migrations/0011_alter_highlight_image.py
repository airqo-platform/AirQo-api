# Generated by Django 5.1.4 on 2024-12-06 16:57

import cloudinary.models
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('highlights', '0010_alter_highlight_image'),
    ]

    operations = [
        migrations.AlterField(
            model_name='highlight',
            name='image',
            field=cloudinary.models.CloudinaryField(blank=True, default='website/uploads/default_image.webp', max_length=255, null=True),
        ),
    ]
