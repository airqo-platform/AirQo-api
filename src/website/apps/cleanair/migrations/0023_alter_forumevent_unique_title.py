# Generated by Django 5.1.4 on 2025-02-15 11:19

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cleanair', '0022_section_update_3'),
    ]

    operations = [
        migrations.AlterField(
            model_name='forumevent',
            name='unique_title',
            field=models.CharField(blank=True, max_length=100, unique=True),
        ),
    ]
