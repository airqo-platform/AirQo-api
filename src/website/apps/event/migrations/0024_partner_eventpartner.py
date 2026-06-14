"""
Migration 0024: Add Partner catalog and EventPartner through model.

Creates:
- `event_partner` table (reusable partner/sponsor catalog)
- `event_eventpartner` table (through model linking events to partners)

Then copies existing PartnerLogo data into the new tables:
- Each unique (name, partner_logo) combination becomes a Partner row.
- Each PartnerLogo row becomes an EventPartner link connecting the
  original event to the new Partner.

The legacy `PartnerLogo` model and table are left untouched.  The API
continues to expose `partner_logos` so existing frontend code keeps
working.
"""
import logging

import django.db.models.deletion
from django.db import migrations, models
import cloudinary.models

logger = logging.getLogger(__name__)


def _migrate_partnerlogo_data(apps, schema_editor):
    """
    Copy existing PartnerLogo rows into Partner + EventPartner.

    This is additive only — no PartnerLogo rows are modified or
    deleted, so no existing data is lost.
    """
    PartnerLogo = apps.get_model("event", "PartnerLogo")
    Partner = apps.get_model("event", "Partner")
    EventPartner = apps.get_model("event", "EventPartner")

    partner_cache = {}  # (name, logo) -> Partner
    linked_pairs = set()  # (event_id, partner_id)
    partners_created = 0
    links_created = 0
    skipped_no_event = 0

    for pl in PartnerLogo.objects.filter(is_deleted=False).order_by("id"):
        # Normalize CloudinaryField value to a plain string for hashing
        # and persistence. CloudinaryField values are not guaranteed to
        # be hashable or plain strings.
        logo_value = str(pl.partner_logo) if pl.partner_logo else ""
        dedup_key = (pl.name, logo_value)

        if dedup_key not in partner_cache:
            from django.utils.text import slugify
            base_slug = slugify(pl.name)[:240] or "partner"
            candidate = base_slug
            counter = 1
            while Partner.objects.filter(slug=candidate).exists():
                candidate = f"{base_slug}-{counter}"
                counter += 1

            partner = Partner.objects.create(
                name=pl.name,
                slug=candidate,
                logo=logo_value or None,
                order=pl.order or 1,
            )
            partner_cache[dedup_key] = partner
            partners_created += 1
        else:
            partner = partner_cache[dedup_key]

        if pl.event_id is None:
            skipped_no_event += 1
            continue

        pair = (pl.event_id, partner.id)
        if pair in linked_pairs:
            continue
        linked_pairs.add(pair)

        EventPartner.objects.create(
            event_id=pl.event_id,
            partner=partner,
            role="partner",
            order=pl.order or 1,
        )
        links_created += 1

    logger.info(
        "Migration 0024 data: created %d Partner rows, "
        "%d EventPartner links, %d PartnerLogo rows had no event",
        partners_created, links_created, skipped_no_event,
    )


def _reverse_partnerlogo_data(apps, schema_editor):
    """Reverse: delete all Partner and EventPartner rows."""
    Partner = apps.get_model("event", "Partner")
    EventPartner = apps.get_model("event", "EventPartner")
    EventPartner.objects.all().delete()
    Partner.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("event", "0023_organizer_eventsideevent_eventorganizer"),
    ]

    operations = [
        # Meta option changes for through models (state-only)
        migrations.AlterModelOptions(
            name="eventorganizer",
            options={
                "ordering": ["order", "id"],
                "verbose_name": "Event organizer link",
                "verbose_name_plural": "Event organizer links",
            },
        ),
        migrations.AlterModelOptions(
            name="eventsideevent",
            options={
                "ordering": ["order", "id"],
                "verbose_name": "Side event link",
                "verbose_name_plural": "Side event links",
            },
        ),
        # Create Partner catalog
        migrations.CreateModel(
            name="Partner",
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
                ("created", models.DateTimeField(auto_now_add=True)),
                ("modified", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("name", models.CharField(max_length=200)),
                (
                    "slug",
                    models.SlugField(
                        blank=True,
                        db_index=True,
                        help_text="URL-friendly identifier for the partner",
                        max_length=255,
                        null=True,
                        unique=True,
                    ),
                ),
                (
                    "logo",
                    cloudinary.models.CloudinaryField(
                        blank=True,
                        default=None,
                        folder="website/uploads/events/partners",
                        max_length=255,
                        null=True,
                        resource_type="image",
                        verbose_name="image",
                    ),
                ),
                ("website_url", models.URLField(blank=True, null=True)),
                ("description", models.TextField(blank=True, null=True)),
                ("order", models.IntegerField(db_index=True, default=1)),
            ],
            options={
                "verbose_name": "Partner",
                "verbose_name_plural": "Partners",
                "ordering": ["order", "name"],
                "abstract": False,
            },
        ),
        migrations.AddIndex(
            model_name="partner",
            index=models.Index(
                fields=["order", "name"],
                name="event_partn_order_a787dd_idx",
            ),
        ),
        # Create EventPartner through model
        migrations.CreateModel(
            name="EventPartner",
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
                ("created", models.DateTimeField(auto_now_add=True)),
                ("modified", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("partner", "Partner"),
                            ("sponsor", "Sponsor"),
                            ("host", "Host"),
                            ("co-organizer", "Co-organizer"),
                            ("supporter", "Supporter"),
                        ],
                        default="partner",
                        max_length=40,
                    ),
                ),
                ("order", models.IntegerField(db_index=True, default=1)),
                (
                    "event",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="event_partner_links",
                        to="event.event",
                    ),
                ),
                (
                    "partner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="event_links",
                        to="event.partner",
                    ),
                ),
            ],
            options={
                "verbose_name": "Event partner link",
                "verbose_name_plural": "Event partner links",
                "ordering": ["order", "id"],
                "abstract": False,
            },
        ),
        migrations.AddConstraint(
            model_name="eventpartner",
            constraint=models.UniqueConstraint(
                fields=("event", "partner"),
                name="unique_event_partner",
            ),
        ),
        migrations.AddIndex(
            model_name="eventpartner",
            index=models.Index(
                fields=["event", "order"],
                name="event_event_event_i_d1e141_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="eventpartner",
            index=models.Index(
                fields=["partner", "order"],
                name="event_event_partner_fee4c9_idx",
            ),
        ),
        # Copy existing PartnerLogo data into Partner + EventPartner
        migrations.RunPython(
            _migrate_partnerlogo_data,
            _reverse_partnerlogo_data,
        ),
    ]
