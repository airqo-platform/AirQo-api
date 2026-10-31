from django.db import migrations, models


DEFAULT_OPENALEX_AUTHOR_IDS = """A5047583981
A5051886991
A5076584166
A5002704292
A5014863511
A5017420345
A5015937838
A5067893766
A5089230857
A5036111960"""

DEFAULT_PUBLICATION_RELEVANCE_KEYWORDS = """air
air quality
air pollution
pollution
pm2.5
pm 2.5
pm10
pm 10
particulate matter
sensor
monitoring
clean air
atmospheric"""


def create_default_feed_settings(apps, schema_editor):
    LivePublicationFeedSettings = apps.get_model(
        "publications", "LivePublicationFeedSettings"
    )
    LivePublicationFeedSettings.objects.using(schema_editor.connection.alias).get_or_create(
        pk=1,
        defaults={
            "enabled": True,
            "openalex_author_ids": DEFAULT_OPENALEX_AUTHOR_IDS,
            "allowed_affiliations": "AirQo",
            "relevance_keywords": DEFAULT_PUBLICATION_RELEVANCE_KEYWORDS,
            "include_all_author_works": False,
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        ("publications", "0015_livepublicationoverride"),
    ]

    operations = [
        migrations.CreateModel(
            name="LivePublicationFeedSettings",
            fields=[
                (
                    "id",
                    models.PositiveSmallIntegerField(
                        default=1, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("enabled", models.BooleanField(default=True)),
                (
                    "openalex_author_ids",
                    models.TextField(
                        blank=True,
                        default=DEFAULT_OPENALEX_AUTHOR_IDS,
                        help_text=(
                            "OpenAlex author IDs, one per line or comma-separated. Use IDs such as "
                            "A5047583981. Leave empty to search using configured affiliations or keywords."
                        ),
                    ),
                ),
                (
                    "allowed_affiliations",
                    models.TextField(
                        blank=True,
                        default="AirQo",
                        help_text=(
                            "Affiliation names to search and match, one per line. A work is relevant "
                            "when any author affiliation contains one of these names."
                        ),
                    ),
                ),
                (
                    "relevance_keywords",
                    models.TextField(
                        blank=True,
                        default=DEFAULT_PUBLICATION_RELEVANCE_KEYWORDS,
                        help_text=(
                            "Publication title or abstract terms that qualify a work, one per line. "
                            "A work is shown when its title or abstract matches a keyword OR an "
                            "author affiliation matches an allowed affiliation, unless all author "
                            "works are included."
                        ),
                    ),
                ),
                (
                    "include_all_author_works",
                    models.BooleanField(
                        default=False,
                        help_text=(
                            "Show every work returned by the configured provider queries without "
                            "filtering by affiliation or relevance keywords."
                        ),
                    ),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "live publication feed settings",
                "verbose_name_plural": "live publication feed settings",
            },
        ),
        migrations.RunPython(
            create_default_feed_settings,
            migrations.RunPython.noop,
        ),
    ]
