# Generated by Django 4.2.16 on 2024-10-22 09:07

from django.db import migrations
import utils.fields


class Migration(migrations.Migration):

    dependencies = [
        ('press', '0003_alter_press_publisher_logo'),
    ]

    operations = [
        migrations.AlterField(
            model_name='press',
            name='publisher_logo',
            field=utils.fields.CustomCloudinaryField(blank=True, default='website/uploads/default_image.webp', max_length=255, null=True),
        ),
    ]
