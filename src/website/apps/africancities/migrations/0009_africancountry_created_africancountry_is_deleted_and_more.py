# Generated by Django 4.2.5 on 2024-11-26 13:44

import datetime
from django.db import migrations, models
import utils.fields


class Migration(migrations.Migration):

    dependencies = [
        ('africancities', '0008_alter_africancountry_country_flag_alter_image_image'),
    ]

    operations = [
        migrations.AddField(
            model_name='africancountry',
            name='created',
            field=models.DateTimeField(auto_now_add=True, default=datetime.datetime(2024, 11, 26, 16, 42, 21, 33922)),
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
        migrations.AddField(
            model_name='city',
            name='created',
            field=models.DateTimeField(auto_now_add=True, default=datetime.datetime(2024, 11, 26, 16, 42, 23, 559513)),
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
            field=models.DateTimeField(auto_now_add=True, default=datetime.datetime(2024, 11, 26, 16, 42, 31, 444596)),
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
            field=models.DateTimeField(auto_now_add=True, default=datetime.datetime(2024, 11, 26, 16, 42, 33, 427129)),
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
            field=models.DateTimeField(auto_now_add=True, default=datetime.datetime(2024, 11, 26, 16, 42, 36, 354950)),
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
        migrations.AlterField(
            model_name='africancountry',
            name='country_flag',
            field=utils.fields.CustomCloudinaryField(blank=True, default='website/uploads/default_image.webp', max_length=255, null=True, validators=[utils.fields.validate_image_format, utils.fields.validate_image_format]),
        ),
        migrations.AlterField(
            model_name='image',
            name='image',
            field=utils.fields.CustomCloudinaryField(blank=True, default='website/uploads/default_image.webp', max_length=255, null=True, validators=[utils.fields.validate_image_format, utils.fields.validate_image_format]),
        ),
    ]
