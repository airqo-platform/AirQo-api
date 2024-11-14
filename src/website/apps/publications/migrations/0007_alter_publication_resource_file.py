# Generated by Django 4.2.16 on 2024-10-26 14:08

from django.db import migrations
import utils.fields


class Migration(migrations.Migration):

    dependencies = [
        ('publications', '0006_alter_publication_resource_file'),
    ]

    operations = [
        migrations.AlterField(
            model_name='publication',
            name='resource_file',
            field=utils.fields.CustomFileField(blank=True, default='uploads/default_file.txt', null=True, upload_to='uploads/files/'),
        ),
    ]
