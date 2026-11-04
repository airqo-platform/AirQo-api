from django.db import migrations, models


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


class Migration(migrations.Migration):
    dependencies = [
        ("publications", "0017_dynamic_livepublicationfeedsettings"),
    ]

    operations = [
        migrations.AlterField(
            model_name="livepublicationfeedsettings",
            name="relevance_keywords",
            field=models.TextField(
                blank=True,
                default=DEFAULT_PUBLICATION_RELEVANCE_KEYWORDS,
                help_text=(
                    "Publication title or abstract terms that qualify a work, one "
                    "per line. A work is shown when its title or abstract matches "
                    "a keyword OR an author affiliation matches an allowed "
                    "affiliation when relevance is required."
                ),
            ),
        ),
        migrations.AlterField(
            model_name="livepublicationfeedsettings",
            name="allowed_affiliations",
            field=models.TextField(
                blank=True,
                default="AirQo",
                help_text=(
                    "Affiliation names to search in Crossref and match in provider "
                    "results, one per line. These are independent of the OpenAlex "
                    "author IDs."
                ),
            ),
        ),
    ]
