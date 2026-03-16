"""Add sync tables

Revision ID: 2b8be7f0d372
Revises: 
Create Date: 2026-02-13 13:03:40.837426

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2b8be7f0d372'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('sync_firmware',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('firmware_version', sa.String(length=100), nullable=False),
        sa.Column('firmware_string', sa.String(length=100), nullable=False),
        sa.Column('firmware_string_hex', sa.String(length=100), nullable=True),
        sa.Column('firmware_string_bootloader', sa.String(length=100), nullable=True),
        sa.Column('firmware_type', sa.String(length=50), server_default='beta', nullable=True),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('crc32', sa.String(length=100), nullable=True),
        sa.Column('firmware_bin_size', sa.Integer(), nullable=True),
        sa.Column('change1', sa.String(length=255), nullable=True),
        sa.Column('change2', sa.String(length=255), nullable=True),
        sa.Column('change3', sa.String(length=255), nullable=True),
        sa.Column('change4', sa.String(length=255), nullable=True),
        sa.Column('change5', sa.String(length=255), nullable=True),
        sa.Column('change6', sa.String(length=255), nullable=True),
        sa.Column('change7', sa.String(length=255), nullable=True),
        sa.Column('change8', sa.String(length=255), nullable=True),
        sa.Column('change9', sa.String(length=255), nullable=True),
        sa.Column('change10', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('category',
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=100), nullable=True),
        sa.Column('field1', sa.String(length=100), nullable=True),
        sa.Column('field2', sa.String(length=100), nullable=True),
        sa.Column('field3', sa.String(length=100), nullable=True),
        sa.Column('field4', sa.String(length=100), nullable=True),
        sa.Column('field5', sa.String(length=100), nullable=True),
        sa.Column('field6', sa.String(length=100), nullable=True),
        sa.Column('field7', sa.String(length=100), nullable=True),
        sa.Column('field8', sa.String(length=100), nullable=True),
        sa.Column('field9', sa.String(length=100), nullable=True),
        sa.Column('field10', sa.String(length=100), nullable=True),
        sa.Column('field11', sa.String(length=100), nullable=True),
        sa.Column('field12', sa.String(length=100), nullable=True),
        sa.Column('field13', sa.String(length=100), nullable=True),
        sa.Column('field14', sa.String(length=100), nullable=True),
        sa.Column('field15', sa.String(length=100), nullable=True),
        sa.Column('metadata1', sa.String(length=100), nullable=True),
        sa.Column('metadata2', sa.String(length=100), nullable=True),
        sa.Column('metadata3', sa.String(length=100), nullable=True),
        sa.Column('metadata4', sa.String(length=100), nullable=True),
        sa.Column('metadata5', sa.String(length=100), nullable=True),
        sa.Column('metadata6', sa.String(length=100), nullable=True),
        sa.Column('metadata7', sa.String(length=100), nullable=True),
        sa.Column('metadata8', sa.String(length=100), nullable=True),
        sa.Column('metadata9', sa.String(length=100), nullable=True),
        sa.Column('metadata10', sa.String(length=100), nullable=True),
        sa.Column('metadata11', sa.String(length=100), nullable=True),
        sa.Column('metadata12', sa.String(length=100), nullable=True),
        sa.Column('metadata13', sa.String(length=100), nullable=True),
        sa.Column('metadata14', sa.String(length=100), nullable=True),
        sa.Column('metadata15', sa.String(length=100), nullable=True),
        sa.Column('config1', sa.String(length=100), nullable=True),
        sa.Column('config2', sa.String(length=100), nullable=True),
        sa.Column('config3', sa.String(length=100), nullable=True),
        sa.Column('config4', sa.String(length=100), nullable=True),
        sa.Column('config5', sa.String(length=100), nullable=True),
        sa.Column('config6', sa.String(length=100), nullable=True),
        sa.Column('config7', sa.String(length=100), nullable=True),
        sa.Column('config8', sa.String(length=100), nullable=True),
        sa.Column('config9', sa.String(length=100), nullable=True),
        sa.Column('config10', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('name')
    )
    op.create_table('sync_device',
        sa.Column('device_id', sa.String(length=100), nullable=False),
        sa.Column('network_id', sa.String(length=100), nullable=True),
        sa.Column('current_firmware', sa.String(length=100), nullable=True),
        sa.Column('previous_firmware', sa.String(length=100), nullable=True),
        sa.Column('target_firmware', sa.String(length=100), nullable=True),
        sa.Column('file_upload_state', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('firmware_download_state', sa.String(length=100), nullable=True),
        sa.PrimaryKeyConstraint('device_id')
    )
    op.create_table('sync_config_values',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('device_id', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('config1', sa.String(length=100), nullable=True),
        sa.Column('config2', sa.String(length=100), nullable=True),
        sa.Column('config3', sa.String(length=100), nullable=True),
        sa.Column('config4', sa.String(length=100), nullable=True),
        sa.Column('config5', sa.String(length=100), nullable=True),
        sa.Column('config6', sa.String(length=100), nullable=True),
        sa.Column('config7', sa.String(length=100), nullable=True),
        sa.Column('config8', sa.String(length=100), nullable=True),
        sa.Column('config9', sa.String(length=100), nullable=True),
        sa.Column('config10', sa.String(length=100), nullable=True),
        sa.Column('config_updated', sa.Boolean(), server_default='false', nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['dim_device.device_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('sync_metadata_values',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('device_id', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('metadata1', sa.String(length=100), nullable=True),
        sa.Column('metadata2', sa.String(length=100), nullable=True),
        sa.Column('metadata3', sa.String(length=100), nullable=True),
        sa.Column('metadata4', sa.String(length=100), nullable=True),
        sa.Column('metadata5', sa.String(length=100), nullable=True),
        sa.Column('metadata6', sa.String(length=100), nullable=True),
        sa.Column('metadata7', sa.String(length=100), nullable=True),
        sa.Column('metadata8', sa.String(length=100), nullable=True),
        sa.Column('metadata9', sa.String(length=100), nullable=True),
        sa.Column('metadata10', sa.String(length=100), nullable=True),
        sa.Column('metadata11', sa.String(length=100), nullable=True),
        sa.Column('metadata12', sa.String(length=100), nullable=True),
        sa.Column('metadata13', sa.String(length=100), nullable=True),
        sa.Column('metadata14', sa.String(length=100), nullable=True),
        sa.Column('metadata15', sa.String(length=100), nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['dim_device.device_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('sync_field_values',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('device_id', sa.String(length=100), nullable=False),
        sa.Column('entry_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('field1', sa.String(length=100), nullable=True),
        sa.Column('field2', sa.String(length=100), nullable=True),
        sa.Column('field3', sa.String(length=100), nullable=True),
        sa.Column('field4', sa.String(length=100), nullable=True),
        sa.Column('field5', sa.String(length=100), nullable=True),
        sa.Column('field6', sa.String(length=100), nullable=True),
        sa.Column('field7', sa.String(length=100), nullable=True),
        sa.Column('field8', sa.String(length=100), nullable=True),
        sa.Column('field9', sa.String(length=100), nullable=True),
        sa.Column('field10', sa.String(length=100), nullable=True),
        sa.Column('field11', sa.String(length=100), nullable=True),
        sa.Column('field12', sa.String(length=100), nullable=True),
        sa.Column('field13', sa.String(length=100), nullable=True),
        sa.Column('field14', sa.String(length=100), nullable=True),
        sa.Column('field15', sa.String(length=100), nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['dim_device.device_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('sync_field_values')
    op.drop_table('sync_metadata_values')
    op.drop_table('sync_config_values')
    op.drop_table('sync_device')
    op.drop_table('category')
    op.drop_table('sync_firmware')
