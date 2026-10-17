"""Add sync_network and external-manufacturer device fields

Beacon previously mirrored only airqo-network devices. Devices from other
sensor manufacturers (airgradient, iqair, metone, ...) are identified by a
serial number and a manufacturer API URL instead of a ThingSpeak channel, so
sync_device gains those columns and a sync_network table mirrors the
platform's list of networks ("sensor manufacturers").

Revision ID: f1a2b3c4d5e6
Revises: e1f2a3b4c5d6
Create Date: 2026-10-12 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'sync_network',
        sa.Column('network_id', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('acronym', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('data_source', sa.String(length=100), nullable=True),
        sa.Column('website', sa.String(length=255), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('profile_picture', sa.String(length=500), nullable=True),
        sa.Column('platform_updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('network_id'),
    )
    op.create_index(op.f('ix_sync_network_name'), 'sync_network', ['name'], unique=True)

    op.add_column('sync_device', sa.Column('serial_number', sa.String(length=100), nullable=True))
    op.add_column('sync_device', sa.Column('api_code', sa.Text(), nullable=True))
    op.add_column('sync_device', sa.Column('auth_required', sa.Boolean(), nullable=True))
    op.create_index(op.f('ix_sync_device_serial_number'), 'sync_device', ['serial_number'], unique=False)
    op.create_index(op.f('ix_sync_device_network_id'), 'sync_device', ['network_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_sync_device_network_id'), table_name='sync_device')
    op.drop_index(op.f('ix_sync_device_serial_number'), table_name='sync_device')
    op.drop_column('sync_device', 'auth_required')
    op.drop_column('sync_device', 'api_code')
    op.drop_column('sync_device', 'serial_number')

    op.drop_index(op.f('ix_sync_network_name'), table_name='sync_network')
    op.drop_table('sync_network')
