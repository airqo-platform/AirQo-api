from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cleanair', '0013_cleanairresource_created_cleanairresource_is_deleted_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='forumevent',
            name='created',
            # Temporarily allow null
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AddField(
            model_name='forumevent',
            name='modified',
            # Temporarily allow null
            field=models.DateTimeField(auto_now=True, null=True),
        ),
        migrations.AddField(
            model_name='forumevent',
            name='is_deleted',
            field=models.BooleanField(default=False),
        ),
    ]
