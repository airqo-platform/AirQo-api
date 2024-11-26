# Generated by Django 4.2.5 on 2024-11-26 08:47

import datetime
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('publications', '0009_publication_created_publication_is_deleted_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='publication',
            name='created',
            field=models.DateTimeField(auto_now_add=True, default=datetime.datetime(2024, 11, 26, 11, 46, 48, 295362)),
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
    ]
