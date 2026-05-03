"""drop sync_bam_performance and sync_device_performance tables

Revision ID: b7f2a1d9e403
Revises: a3d0ced5c059
Create Date: 2026-05-03 14:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7f2a1d9e403'
down_revision: Union[str, None] = 'a3d0ced5c059'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop indexes first, then tables
    op.drop_index(op.f('ix_sync_device_performance_device_name'), table_name='sync_device_performance')
    op.drop_index('ix_computed_for_date', table_name='sync_device_performance')
    op.drop_table('sync_device_performance')

    op.drop_index(op.f('ix_sync_bam_performance_device_name'), table_name='sync_bam_performance')
    op.drop_index('ix_bam_computed_for_date', table_name='sync_bam_performance')
    op.drop_table('sync_bam_performance')


def downgrade() -> None:
    # Recreate sync_bam_performance
    op.create_table('sync_bam_performance',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('device_id', sa.String(length=100), nullable=False),
    sa.Column('device_name', sa.String(length=200), nullable=False),
    sa.Column('latitude', sa.Float(), nullable=True),
    sa.Column('longitude', sa.Float(), nullable=True),
    sa.Column('uptime', sa.Float(), nullable=False),
    sa.Column('data_completeness', sa.Float(), nullable=False),
    sa.Column('realtime_conc_average', sa.Float(), nullable=True),
    sa.Column('short_time_conc_average', sa.Float(), nullable=True),
    sa.Column('hourly_conc_average', sa.Float(), nullable=True),
    sa.Column('computed_for_date', sa.Date(), nullable=False),
    sa.Column('computed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('device_name', 'computed_for_date', name='uq_bam_device_name_date')
    )
    op.create_index('ix_bam_computed_for_date', 'sync_bam_performance', ['computed_for_date'], unique=False)
    op.create_index(op.f('ix_sync_bam_performance_device_name'), 'sync_bam_performance', ['device_name'], unique=False)

    # Recreate sync_device_performance
    op.create_table('sync_device_performance',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('device_id', sa.String(length=100), nullable=False),
    sa.Column('device_name', sa.String(length=200), nullable=False),
    sa.Column('latitude', sa.Float(), nullable=True),
    sa.Column('longitude', sa.Float(), nullable=True),
    sa.Column('last_active', sa.String(length=100), nullable=True),
    sa.Column('uptime', sa.Float(), nullable=False),
    sa.Column('data_completeness', sa.Float(), nullable=False),
    sa.Column('error_margin', sa.Float(), nullable=False),
    sa.Column('s1_pm2_5_average', sa.Float(), nullable=True),
    sa.Column('s2_pm2_5_average', sa.Float(), nullable=True),
    sa.Column('correlation', sa.Float(), nullable=True),
    sa.Column('cohorts_json', sa.Text(), nullable=True),
    sa.Column('complete_performance', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('computed_for_date', sa.Date(), nullable=False),
    sa.Column('computed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('device_name', 'computed_for_date', name='uq_device_name_date')
    )
    op.create_index('ix_computed_for_date', 'sync_device_performance', ['computed_for_date'], unique=False)
    op.create_index(op.f('ix_sync_device_performance_device_name'), 'sync_device_performance', ['device_name'], unique=False)
