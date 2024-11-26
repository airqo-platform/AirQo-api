# Generated by Django 4.2.5 on 2024-11-26 12:15

import datetime
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('highlights', '0010_highlight_created_highlight_is_deleted_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='highlight',
            name='created',
            field=models.DateTimeField(auto_now_add=True, default=datetime.datetime(2024, 11, 26, 15, 15, 3, 18856)),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='highlight',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='highlight',
            name='modified',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name='tag',
            name='created',
            field=models.DateTimeField(auto_now_add=True, default=datetime.datetime(2024, 11, 26, 15, 15, 5, 71394)),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='tag',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='tag',
            name='modified',
            field=models.DateTimeField(auto_now=True),
        ),
    ]
