from django.db import migrations
import json
from html.parser import HTMLParser


def transform_quill_to_plain_text(apps, schema_editor):
    """
    Transform QuillField data stored in JSON or HTML format into plain text for TextField.
    """
    # Get the Session model
    Session = apps.get_model('cleanair', 'Session')

    class HTMLToTextParser(HTMLParser):
        """Utility to convert HTML content to plain text."""

        def __init__(self):
            super().__init__()
            self.text_parts = []

        def handle_data(self, data):
            self.text_parts.append(data)

        def handle_starttag(self, tag, attrs):
            if tag in ['br', 'p']:
                self.text_parts.append("\n")  # Add new line for certain tags

        def get_text(self):
            return ''.join(self.text_parts).strip()

    def extract_plain_text(data):
        """
        Extract plain text from stored QuillField JSON or HTML data.
        """
        try:
            # Attempt to parse JSON content
            parsed = json.loads(data)
            if "delta" in parsed:
                # Handle Quill Delta JSON format
                ops = json.loads(parsed["delta"]).get("ops", [])
                plain_text = "".join(op.get("insert", "") for op in ops)
                return plain_text.strip()
            elif "html" in parsed:
                # Handle Quill HTML content
                html_parser = HTMLToTextParser()
                html_parser.feed(parsed["html"])
                return html_parser.get_text()
        except (json.JSONDecodeError, KeyError, AttributeError):
            pass  # Fallback to HTML parsing below

        # Handle plain HTML directly
        html_parser = HTMLToTextParser()
        html_parser.feed(data)
        return html_parser.get_text()

    # Process Session model
    for session in Session.objects.all():
        try:
            session.session_details = extract_plain_text(
                session.session_details
            )
            session.save()
        except Exception as e:
            print(f"Failed to process Session ID {session.id}: {e}")


class Migration(migrations.Migration):

    dependencies = [
        ('cleanair', '0016_alter_engagement_forum_event_and_more'),
    ]

    operations = [
        migrations.RunPython(transform_quill_to_plain_text),
    ]
