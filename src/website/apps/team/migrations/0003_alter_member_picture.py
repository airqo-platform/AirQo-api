# Generated by Django 4.2.16 on 2024-10-26 14:08

from django.db import migrations
import utils.fields


class Migration(migrations.Migration):

    dependencies = [
        ('team', '0002_alter_member_picture'),
    ]

    operations = [
        migrations.AlterField(
            model_name='member',
            name='picture',
            field=utils.fields.CustomImageField(blank=True, default='uploads/default_image.webp', null=True, upload_to='uploads/images/'),
        ),
    ]