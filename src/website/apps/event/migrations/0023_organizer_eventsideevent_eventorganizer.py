"""
Migration 0023: Add Organizer, EventOrganizer, and EventSideEvent models.

Safe for:
- Production DBs where these tables already exist from a previously applied
  but now-missing migration.
- Fresh test DBs where the tables must be created.
"""
import logging

import django.db.models.deletion
from django.db import migrations, models
import cloudinary.models

logger = logging.getLogger(__name__)


def forwards(apps, schema_editor):
    """
    Create tables IF they don't already exist.

    Uses introspection to check whether the table already exists
    before attempting CREATE TABLE.  Works on PostgreSQL, SQLite, and
    MySQL 5.6+.
    """
    # Collect the models from the post-state-operations migration state.
    model_names = ("Organizer", "EventOrganizer", "EventSideEvent")
    models_to_create = []
    for name in model_names:
        try:
            models_to_create.append(apps.get_model("event", name))
        except LookupError:
            # Model not in state — shouldn't happen, but skip gracefully.
            pass

    if not models_to_create:
        # As a last resort, fall back to raw SQL table creation using
        # the schema editor's connection directly.
        _create_tables_raw(schema_editor)
        return

    # Build the set of existing table names via introspection.
    table_names = set(
        schema_editor.connection.introspection.table_names(
            schema_editor.connection.cursor()
        )
    )

    for model in models_to_create:
        table = model._meta.db_table
        if table in table_names:
            continue
        schema_editor.create_model(model)


def _create_tables_raw(schema_editor):
    """
    Last-resort fallback: create tables via raw SQL when model
    introspection fails.
    """
    conn = schema_editor.connection
    qn = schema_editor.quote_name

    # Check existing tables
    existing = set(conn.introspection.table_names(conn.cursor()))

    if "event_organizer" not in existing:
        conn.cursor().execute(f"""
            CREATE TABLE {qn("event_organizer")} (
                "id" bigserial PRIMARY KEY,
                "created" timestamp with time zone NOT NULL,
                "modified" timestamp with time zone NOT NULL,
                "is_deleted" boolean NOT NULL,
                "name" varchar(200) NOT NULL,
                "slug" varchar(255) UNIQUE,
                "logo" varchar(255),
                "website_url" varchar(200),
                "description" text,
                "order" integer NOT NULL DEFAULT 1
            )
        """)
        conn.cursor().execute(
            f'CREATE INDEX {qn("event_organ_order_167e01_idx")} '
            f'ON {qn("event_organizer")} ("order", "name")'
        )

    if "event_eventorganizer" not in existing:
        conn.cursor().execute(f"""
            CREATE TABLE {qn("event_eventorganizer")} (
                "id" bigserial PRIMARY KEY,
                "created" timestamp with time zone NOT NULL,
                "modified" timestamp with time zone NOT NULL,
                "is_deleted" boolean NOT NULL,
                "order" integer NOT NULL DEFAULT 1,
                "role" varchar(40) NOT NULL DEFAULT 'organizer',
                "event_id" bigint NOT NULL
                    REFERENCES {qn("event_event")}("id") ON DELETE CASCADE,
                "organizer_id" bigint NOT NULL
                    REFERENCES {qn("event_organizer")}("id") ON DELETE CASCADE,
                UNIQUE ("event_id", "organizer_id")
            )
        """)
        conn.cursor().execute(
            f'CREATE INDEX {qn("event_event_event_i_7d9242_idx")} '
            f'ON {qn("event_eventorganizer")} ("event_id", "order")'
        )
        conn.cursor().execute(
            f'CREATE INDEX {qn("event_event_organiz_de075c_idx")} '
            f'ON {qn("event_eventorganizer")} ("organizer_id", "order")'
        )

    if "event_eventsideevent" not in existing:
        conn.cursor().execute(f"""
            CREATE TABLE {qn("event_eventsideevent")} (
                "id" bigserial PRIMARY KEY,
                "created" timestamp with time zone NOT NULL,
                "modified" timestamp with time zone NOT NULL,
                "is_deleted" boolean NOT NULL,
                "order" integer NOT NULL DEFAULT 1,
                "label" varchar(100) NOT NULL DEFAULT 'Side event',
                "parent_event_id" bigint NOT NULL
                    REFERENCES {qn("event_event")}("id") ON DELETE CASCADE,
                "side_event_id" bigint NOT NULL
                    REFERENCES {qn("event_event")}("id") ON DELETE CASCADE,
                UNIQUE ("parent_event_id", "side_event_id")
            )
        """)
        conn.cursor().execute(
            f'CREATE INDEX {qn("event_event_parent__ecc6f9_idx")} '
            f'ON {qn("event_eventsideevent")} ("parent_event_id", "order")'
        )
        conn.cursor().execute(
            f'CREATE INDEX {qn("event_event_side_ev_69b730_idx")} '
            f'ON {qn("event_eventsideevent")} ("side_event_id", "order")'
        )


def backwards(apps, schema_editor):
    """Drop the tables (reverse of forwards)."""
    try:
        EventSideEvent = apps.get_model("event", "EventSideEvent")
        EventOrganizer = apps.get_model("event", "EventOrganizer")
        Organizer = apps.get_model("event", "Organizer")
    except LookupError:
        return
    for model in (EventSideEvent, EventOrganizer, Organizer):
        try:
            schema_editor.delete_model(model)
        except Exception:
            pass


class Migration(migrations.Migration):

    dependencies = [
        ("event", "0022_alter_event_event_details_and_more"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name="Organizer",
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
                                help_text="URL-friendly identifier for the organizer",
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
                                folder="website/uploads/events/organizers",
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
                        "ordering": ["order", "name"],
                        "abstract": False,
                    },
                ),
                migrations.CreateModel(
                    name="EventOrganizer",
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
                                    ("organizer", "Organizer"),
                                    ("co-organizer", "Co-organizer"),
                                    ("host", "Host"),
                                    ("partner", "Partner"),
                                    ("sponsor", "Sponsor"),
                                ],
                                default="organizer",
                                max_length=40,
                            ),
                        ),
                        ("order", models.IntegerField(db_index=True, default=1)),
                        (
                            "event",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="event_organizer_links",
                                to="event.event",
                            ),
                        ),
                        (
                            "organizer",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="event_links",
                                to="event.organizer",
                            ),
                        ),
                    ],
                    options={
                        "ordering": ["order", "id"],
                        "abstract": False,
                    },
                ),
                migrations.AddConstraint(
                    model_name="eventorganizer",
                    constraint=models.UniqueConstraint(
                        fields=("event", "organizer"),
                        name="unique_event_organizer",
                    ),
                ),
                migrations.AddIndex(
                    model_name="eventorganizer",
                    index=models.Index(
                        fields=["event", "order"],
                        name="event_event_event_i_7d9242_idx",
                    ),
                ),
                migrations.AddIndex(
                    model_name="eventorganizer",
                    index=models.Index(
                        fields=["organizer", "order"],
                        name="event_event_organiz_de075c_idx",
                    ),
                ),
                migrations.CreateModel(
                    name="EventSideEvent",
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
                            "label",
                            models.CharField(
                                default="Side event",
                                help_text=(
                                    "Optional label describing the relationship "
                                    "(e.g. 'Side event', 'Sub-event', "
                                    "'Parallel session')."
                                ),
                                max_length=100,
                            ),
                        ),
                        ("order", models.IntegerField(db_index=True, default=1)),
                        (
                            "parent_event",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="side_event_links",
                                to="event.event",
                            ),
                        ),
                        (
                            "side_event",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="parent_event_links",
                                to="event.event",
                            ),
                        ),
                    ],
                    options={
                        "ordering": ["order", "id"],
                        "abstract": False,
                    },
                ),
                migrations.AddConstraint(
                    model_name="eventsideevent",
                    constraint=models.UniqueConstraint(
                        fields=("parent_event", "side_event"),
                        name="unique_parent_side_event",
                    ),
                ),
                migrations.AddIndex(
                    model_name="eventsideevent",
                    index=models.Index(
                        fields=["parent_event", "order"],
                        name="event_event_parent__ecc6f9_idx",
                    ),
                ),
                migrations.AddIndex(
                    model_name="eventsideevent",
                    index=models.Index(
                        fields=["side_event", "order"],
                        name="event_event_side_ev_69b730_idx",
                    ),
                ),
                migrations.AddIndex(
                    model_name="organizer",
                    index=models.Index(
                        fields=["order", "name"],
                        name="event_organ_order_167e01_idx",
                    ),
                ),
            ],
            database_operations=[
                migrations.RunPython(forwards, backwards),
            ],
        ),
    ]
