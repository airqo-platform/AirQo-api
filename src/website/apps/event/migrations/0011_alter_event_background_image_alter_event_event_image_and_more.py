# Generated by Django 4.2.5 on 2024-12-04 13:51

from django.db import migrations, models
import utils.validators


class Migration(migrations.Migration):

    dependencies = [
        ('event', '0010_alter_event_background_image_alter_event_event_image_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='event',
            name='background_image',
            field=models.ImageField(blank=True, null=True, upload_to='website/uploads/events/images', validators=[utils.validators.validate_image]),
        ),
        migrations.AlterField(
            model_name='event',
            name='event_image',
            field=models.ImageField(blank=True, null=True, upload_to='website/uploads/events/images', validators=[utils.validators.validate_image]),
        ),
        migrations.AlterField(
            model_name='partnerlogo',
            name='partner_logo',
            field=models.ImageField(blank=True, null=True, upload_to='website/uploads/events/logos/', validators=[utils.validators.validate_image]),
        ),
        migrations.AlterField(
            model_name='resource',
            name='resource',
            field=models.FileField(blank=True, null=True, upload_to='website/uploads/events/files/', validators=[utils.validators.validate_file]),
        ),
    ]
