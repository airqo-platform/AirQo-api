# Generated by Django 5.1.4 on 2024-12-06 10:08

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('event', '0011_alter_event_background_image_alter_event_event_image_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='program',
            name='program_details',
            field=models.TextField(default='No details available yet.'),
        ),
        migrations.AlterField(
            model_name='session',
            name='session_details',
            field=models.TextField(default='No details available yet.'),
        ),
    ]
