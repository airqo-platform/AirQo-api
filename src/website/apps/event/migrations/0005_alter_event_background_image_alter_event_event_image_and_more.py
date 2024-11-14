# Generated by Django 4.2.16 on 2024-10-23 18:21

from django.db import migrations
import utils.fields


class Migration(migrations.Migration):

    dependencies = [
        ('event', '0004_alter_event_background_image_alter_event_event_image_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='event',
            name='background_image',
            field=utils.fields.CustomImageField(blank=True, default='uploads/default_image.webp', null=True, upload_to='uploads/images/'),
        ),
        migrations.AlterField(
            model_name='event',
            name='event_image',
            field=utils.fields.CustomImageField(blank=True, default='uploads/default_image.webp', null=True, upload_to='uploads/images/'),
        ),
        migrations.AlterField(
            model_name='partnerlogo',
            name='partner_logo',
            field=utils.fields.CustomImageField(blank=True, default='uploads/default_image.webp', null=True, upload_to='uploads/images/'),
        ),
        migrations.AlterField(
            model_name='resource',
            name='resource',
            field=utils.fields.CustomFileField(blank=True, default='uploads/default_file.txt', null=True, upload_to='uploads/files/'),
        ),
    ]
