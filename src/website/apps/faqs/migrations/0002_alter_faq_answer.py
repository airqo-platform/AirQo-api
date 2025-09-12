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
    # Use iterator() to avoid loading all rows into memory at once
    for faq in FAQ.objects.all().iterator():
        text = faq.answer or ""
        parsed = None
        # Try to parse existing content as JSON and detect Quill Delta shape
        try:
            parsed = json.loads(text)
            # Check for Quill Delta shape: dict with 'ops' key that's a list
            if isinstance(parsed, dict) and isinstance(parsed.get('ops'), list):
                ops = parsed.get('ops') or []
                # Optionally verify each op is a dict containing an 'insert' key
                ops_ok = True
                for op in ops:
                    if not (isinstance(op, dict) and 'insert' in op):
                        ops_ok = False
                        break
                if ops_ok:
                    continue  # Already a Quill Delta, skip transformation
            # Any other JSON shape should be treated as non-Quill and re-wrapped
        except (json.JSONDecodeError, TypeError):
            parsed = None

        # Convert plain text or non-Delta JSON to Quill Delta JSON
        if text and text.strip():
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
