# Generated by Django 4.2.16 on 2024-10-26 14:08

from django.db import migrations
import utils.fields


class Migration(migrations.Migration):

    dependencies = [
        ('highlights', '0006_alter_highlight_image'),
    ]

    operations = [
        migrations.AlterField(
            model_name='highlight',
            name='image',
            field=utils.fields.CustomImageField(blank=True, default='website/uploads/default_image.webp', null=True, upload_to='uploads/images/'),
        ),
    ]