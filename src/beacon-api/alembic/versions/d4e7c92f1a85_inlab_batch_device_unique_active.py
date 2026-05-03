"""enforce one active inlab batch per device

Revision ID: d4e7c92f1a85
Revises: b7f2a1d9e403
Create Date: 2026-05-03 00:00:00.000000

Adds a partial unique index on ``sync_inlab_batch_device.device_id`` for
rows where ``is_removed = false`` so the database guarantees a device is
linked to at most one active inlab batch at a time.

To preserve the rule that "active" also means the parent batch is not
soft-deleted, the migration first backfills ``is_removed = true`` on all
links whose batch is already ``is_deleted = true`` (otherwise stale links
to deleted batches would block legitimate new links).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4e7c92f1a85"
down_revision: Union[str, None] = "b7f2a1d9e403"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEX_NAME = "uq_sync_inlab_batch_device_active_device"


def upgrade() -> None:
    # Backfill: mark links as removed if their parent batch is soft-deleted
    # so the partial unique index can be created without duplicate-active rows.
    op.execute(
        """
        UPDATE sync_inlab_batch_device sibd
        SET is_removed = true
        FROM sync_inlab_batch sib
        WHERE sibd.batch_id = sib.id
          AND sib.is_deleted = true
          AND sibd.is_removed = false
        """
    )

    # Resolve any remaining duplicate active links by keeping only the most
    # recent (by created_at) per device_id.
    op.execute(
        """
        UPDATE sync_inlab_batch_device sibd
        SET is_removed = true
        WHERE sibd.is_removed = false
          AND sibd.id NOT IN (
              SELECT DISTINCT ON (device_id) id
              FROM sync_inlab_batch_device
              WHERE is_removed = false
              ORDER BY device_id, created_at DESC NULLS LAST, id
          )
        """
    )

    op.create_index(
        INDEX_NAME,
        "sync_inlab_batch_device",
        ["device_id"],
        unique=True,
        postgresql_where=sa.text("is_removed = false"),
    )


def downgrade() -> None:
    op.drop_index(INDEX_NAME, table_name="sync_inlab_batch_device")
