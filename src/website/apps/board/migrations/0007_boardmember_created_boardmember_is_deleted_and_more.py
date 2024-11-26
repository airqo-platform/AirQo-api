# Generated by Django 4.2.5 on 2024-11-26 12:15

import datetime
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0006_boardmember_created_boardmember_is_deleted_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='boardmember',
            name='created',
            field=models.DateTimeField(auto_now_add=True, default=datetime.datetime(2024, 11, 26, 15, 14, 43, 511410)),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='boardmember',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='boardmember',
            name='modified',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name='boardmemberbiography',
            name='created',
            field=models.DateTimeField(auto_now_add=True, default=datetime.datetime(2024, 11, 26, 15, 14, 44, 923571)),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='boardmemberbiography',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='boardmemberbiography',
            name='modified',
            field=models.DateTimeField(auto_now=True),
        ),
    ]