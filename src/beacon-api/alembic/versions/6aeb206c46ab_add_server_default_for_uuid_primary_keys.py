"""Add server default for UUID primary keys

Revision ID: 6aeb206c46ab
Revises: 2b8be7f0d372
Create Date: 2026-02-13 13:11:42.099379

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6aeb206c46ab'
down_revision: Union[str, Sequence[str], None] = '2b8be7f0d372'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add server default for sync_* tables UUID IDs
    op.alter_column('sync_firmware', 'id',
               existing_type=sa.UUID(),
               server_default=sa.text('gen_random_uuid()'))
    
    op.alter_column('sync_config_values', 'id',
               existing_type=sa.UUID(),
               server_default=sa.text('gen_random_uuid()'))
    
    op.alter_column('sync_metadata_values', 'id',
               existing_type=sa.UUID(),
               server_default=sa.text('gen_random_uuid()'))
    
    op.alter_column('sync_field_values', 'id',
               existing_type=sa.UUID(),
               server_default=sa.text('gen_random_uuid()'))

    # Create beacons table
    op.create_table('beacons',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_beacons_id'), 'beacons', ['id'], unique=False)
    op.create_index(op.f('ix_beacons_name'), 'beacons', ['name'], unique=False)
    op.create_index(op.f('ix_beacons_uuid'), 'beacons', ['uuid'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_beacons_uuid'), table_name='beacons')
    op.drop_index(op.f('ix_beacons_name'), table_name='beacons')
    op.drop_index(op.f('ix_beacons_id'), table_name='beacons')
    op.drop_table('beacons')

    op.alter_column('sync_field_values', 'id',
               existing_type=sa.UUID(),
               server_default=None)
    
    op.alter_column('sync_metadata_values', 'id',
               existing_type=sa.UUID(),
               server_default=None)
    
    op.alter_column('sync_config_values', 'id',
               existing_type=sa.UUID(),
               server_default=None)
    
    op.alter_column('sync_firmware', 'id',
               existing_type=sa.UUID(),
               server_default=None)
