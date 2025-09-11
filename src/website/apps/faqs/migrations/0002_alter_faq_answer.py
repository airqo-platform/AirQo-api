# Generated migration for FAQ model to use QuillField
from django.db import migrations, models
import django_quill.fields
import json


def transform_text_to_quill(apps, schema_editor):
    """
    Transform existing TextField answers to QuillField-compatible JSON.
    Converts plain text to Quill Delta format: {"ops": [{"insert": "text\n"}]}
    """
    FAQ = apps.get_model('faqs', 'FAQ')
    for faq in FAQ.objects.all():
        text = faq.answer or ""
        # Check if it's already JSON (skip if so)
        try:
            json.loads(text)
            continue  # Already looks like JSON, skip transformation
        except (json.JSONDecodeError, TypeError):
            pass

        # Convert plain text to Quill Delta JSON
        if text.strip():
            delta = {"ops": [{"insert": text + "\n"}]}
        else:
            delta = {"ops": []}

        faq.answer = json.dumps(delta)
        faq.save(update_fields=['answer'])


class Migration(migrations.Migration):

    dependencies = [
        ('faqs', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(transform_text_to_quill,
                             reverse_code=migrations.RunPython.noop),
        migrations.AlterField(
            model_name='faq',
            name='answer',
            field=django_quill.fields.QuillField(blank=True, default=''),
        ),
    ]
