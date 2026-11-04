from django.db import migrations, models


DEFAULT_OPENALEX_API_URL = "https://api.openalex.org/works"
DEFAULT_CROSSREF_API_URL = "https://api.crossref.org/works"
DEFAULT_CROSSREF_MAILTO = "info@airqo.net"


def copy_relevance_policy(apps, schema_editor):
    settings_model = apps.get_model("publications", "LivePublicationFeedSettings")
    manager = settings_model.objects.using(schema_editor.connection.alias)

    for row in manager.all().iterator():
        row.relevance_required = not row.include_all_author_works
        row.save(update_fields=["relevance_required"])


def restore_relevance_policy(apps, schema_editor):
    settings_model = apps.get_model("publications", "LivePublicationFeedSettings")
    manager = settings_model.objects.using(schema_editor.connection.alias)

    for row in manager.all().iterator():
        row.include_all_author_works = not row.relevance_required
        row.save(update_fields=["include_all_author_works"])


class Migration(migrations.Migration):
    dependencies = [
        ("publications", "0016_livepublicationfeedsettings"),
    ]

    operations = [
        migrations.AddField(
            model_name="livepublicationfeedsettings",
            name="relevance_required",
            field=models.BooleanField(
                default=True,
                help_text=(
                    "Require an allowed affiliation or relevance keyword before a "
                    "work is shown. Disable this only when all works returned for "
                    "the configured author or affiliation queries should be displayed."
                ),
            ),
        ),
        migrations.AddField(
            model_name="livepublicationfeedsettings",
            name="openalex_api_url",
            field=models.URLField(
                default=DEFAULT_OPENALEX_API_URL,
                help_text="Official OpenAlex works endpoint.",
            ),
        ),
        migrations.AddField(
            model_name="livepublicationfeedsettings",
            name="crossref_api_url",
            field=models.URLField(
                default=DEFAULT_CROSSREF_API_URL,
                help_text="Official Crossref works endpoint.",
            ),
        ),
        migrations.AddField(
            model_name="livepublicationfeedsettings",
            name="crossref_mailto",
            field=models.EmailField(
                blank=True,
                default=DEFAULT_CROSSREF_MAILTO,
                help_text="Optional contact email sent to Crossref for polite-pool access.",
                max_length=254,
            ),
        ),
        migrations.RunPython(copy_relevance_policy, restore_relevance_policy),
        migrations.RemoveField(
            model_name="livepublicationfeedsettings",
            name="include_all_author_works",
        ),
    ]
