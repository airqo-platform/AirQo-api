# Generated by Django 5.1.4 on 2024-12-06 17:35

import cloudinary.models
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('team', '0006_alter_member_picture'),
    ]

    operations = [
        migrations.AlterField(
            model_name='member',
            name='picture',
            field=cloudinary.models.CloudinaryField(blank=True, max_length=255, null=True),
        ),
    ]
