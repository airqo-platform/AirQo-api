"""Add device_readings_refresh

Endpoints that show a single device refresh its readings in the background
when they are stale. This table lets one refresh per device run at a time
across workers and replicas, and holds the outcome for a short cooldown so a
device that has stopped reporting is not refetched on every view.

Revision ID: a7c3e9f1b2d4
Revises: f1a2b3c4d5e6
Create Date: 2026-10-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7c3e9f1b2d4'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'device_readings_refresh',
        sa.Column('device_id', sa.String(length=100), nullable=False),
        sa.Column('state', sa.String(length=20), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('device_id'),
    )


def downgrade() -> None:
    op.drop_table('device_readings_refresh')
