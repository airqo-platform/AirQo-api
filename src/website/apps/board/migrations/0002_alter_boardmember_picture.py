# Generated by Django 4.2.16 on 2024-10-23 18:41

from django.db import migrations
import utils.fields


class Migration(migrations.Migration):

    dependencies = [
        ('board', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='boardmember',
            name='picture',
            field=utils.fields.CustomCloudinaryField(blank=True, default='website/uploads/default_image.webp', max_length=255, null=True),
        ),
    ]
