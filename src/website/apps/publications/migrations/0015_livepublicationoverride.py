from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("publications", "0014_alter_publication_order"),
    ]

    operations = [
        migrations.CreateModel(
            name="LivePublicationOverride",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "external_identifier",
                    models.CharField(
                        help_text=(
                            "Use doi:<doi> (for example doi:10.1234/example), or "
                            "openalex:<work-id> (for example openalex:W123456789)."
                        ),
                        max_length=255,
                        unique=True,
                    ),
                ),
                (
                    "authors",
                    models.TextField(
                        blank=True,
                        help_text="Optional author override. Enter one author per line.",
                    ),
                ),
                (
                    "journal",
                    models.CharField(
                        blank=True,
                        help_text="Optional publication source, journal, or venue override.",
                        max_length=255,
                    ),
                ),
                ("created", models.DateTimeField(auto_now_add=True)),
                ("modified", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "live publication metadata override",
                "verbose_name_plural": "live publication metadata overrides",
                "ordering": ["external_identifier"],
            },
        ),
    ]
