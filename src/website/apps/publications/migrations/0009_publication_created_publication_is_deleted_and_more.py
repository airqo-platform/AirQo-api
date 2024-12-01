# Generated by Django 4.2.5 on 2024-11-26 13:44

import datetime
from django.db import migrations, models
import utils.fields


class Migration(migrations.Migration):

    dependencies = [
        ('publications', '0008_alter_publication_resource_file'),
    ]

    operations = [
        migrations.AddField(
            model_name='publication',
            name='created',
            field=models.DateTimeField(auto_now_add=True, default=datetime.datetime(2024, 11, 26, 16, 44, 16, 463607)),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='publication',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='publication',
            name='modified',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AlterField(
            model_name='publication',
            name='resource_file',
            field=utils.fields.CustomCloudinaryField(blank=True, default='website/uploads/default_image.webp', max_length=255, null=True, validators=[utils.fields.validate_image_format, utils.fields.validate_image_format]),
        ),
    ]
