# Generated by Django 4.2.5 on 2024-11-26 12:18

from django.db import migrations
import utils.fields


class Migration(migrations.Migration):

    dependencies = [
        ('cleanair', '0016_alter_cleanairresource_created_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='cleanairresource',
            name='resource_file',
            field=utils.fields.CustomFileField(blank=True, default='uploads/default_file.txt', null=True, upload_to='uploads/files/'),
        ),
        migrations.AlterField(
            model_name='forumevent',
            name='background_image',
            field=utils.fields.CustomImageField(blank=True, default='uploads/default_image.webp', null=True, upload_to='uploads/images/', validators=[utils.fields.validate_image_format]),
        ),
        migrations.AlterField(
            model_name='partner',
            name='partner_logo',
            field=utils.fields.CustomImageField(blank=True, default='uploads/default_image.webp', null=True, upload_to='uploads/images/', validators=[utils.fields.validate_image_format]),
        ),
        migrations.AlterField(
            model_name='person',
            name='picture',
            field=utils.fields.CustomImageField(blank=True, default='uploads/default_image.webp', null=True, upload_to='uploads/images/', validators=[utils.fields.validate_image_format]),
        ),
        migrations.AlterField(
            model_name='resourcefile',
            name='file',
            field=utils.fields.CustomFileField(blank=True, default='uploads/default_file.txt', null=True, upload_to='uploads/files/'),
        ),
    ]
