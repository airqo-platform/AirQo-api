# Generated by Django 4.2.5 on 2024-11-26 08:47

import datetime
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('africancities', '0009_africancountry_created_africancountry_is_deleted_and_more'),
    ]

    operations = [
        # migrations.AddField(
        #     model_name='africancountry',
        #     name='created',
        #     field=models.DateTimeField(auto_now_add=True, default=datetime.datetime(2024, 11, 26, 11, 32, 43, 837112)),
        #     preserve_default=False,
        # ),
        # migrations.AddField(
        #     model_name='africancountry',
        #     name='is_deleted',
        #     field=models.BooleanField(default=False),
        # ),
        # migrations.AddField(
        #     model_name='africancountry',
        #     name='modified',
        #     field=models.DateTimeField(auto_now=True),
        # ),
        migrations.AddField(
            model_name='city',
            name='created',
            field=models.DateTimeField(auto_now_add=True, default=datetime.datetime(
                2024, 11, 26, 11, 32, 48, 566917)),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='city',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='city',
            name='modified',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name='content',
            name='created',
            field=models.DateTimeField(auto_now_add=True, default=datetime.datetime(
                2024, 11, 26, 11, 32, 51, 682199)),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='content',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='content',
            name='modified',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name='description',
            name='created',
            field=models.DateTimeField(auto_now_add=True, default=datetime.datetime(
                2024, 11, 26, 11, 32, 53, 726466)),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='description',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='description',
            name='modified',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name='image',
            name='created',
            field=models.DateTimeField(auto_now_add=True, default=datetime.datetime(
                2024, 11, 26, 11, 32, 56, 110286)),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='image',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='image',
            name='modified',
            field=models.DateTimeField(auto_now=True),
        ),
    ]