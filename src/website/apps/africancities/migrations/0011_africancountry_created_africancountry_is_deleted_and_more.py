# Generated by Django 4.2.5 on 2024-11-26 12:15

import datetime
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('africancities', '0010_africancountry_created_africancountry_is_deleted_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='africancountry',
            name='created',
            field=models.DateTimeField(auto_now_add=True, default=datetime.datetime(2024, 11, 26, 15, 14, 41, 775550)),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='africancountry',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='africancountry',
            name='modified',
            field=models.DateTimeField(auto_now=True),
        ),
    ]
