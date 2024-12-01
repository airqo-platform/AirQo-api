# Generated by Django 4.2.5 on 2024-11-26 12:19

from django.db import migrations
import utils.fields


class Migration(migrations.Migration):

    dependencies = [
        ('africancities', '0012_alter_africancountry_country_flag_alter_image_image'),
    ]

    operations = [
        migrations.AlterField(
            model_name='africancountry',
            name='country_flag',
            field=utils.fields.CustomCloudinaryField(blank=True, default='website/uploads/default_image.webp', max_length=255, null=True, validators=[utils.fields.validate_image_format]),
        ),
        migrations.AlterField(
            model_name='image',
            name='image',
            field=utils.fields.CustomCloudinaryField(blank=True, default='website/uploads/default_image.webp', max_length=255, null=True, validators=[utils.fields.validate_image_format]),
        ),
    ]