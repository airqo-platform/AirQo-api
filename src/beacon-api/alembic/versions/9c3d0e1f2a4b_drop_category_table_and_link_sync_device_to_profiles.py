"""Drop category table and link sync_device to device_profiles

Revision ID: 9c3d0e1f2a4b
Revises: 8b2f9c0d1e3a
Create Date: 2026-08-28 12:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9c3d0e1f2a4b'
down_revision: Union[str, None] = '8b2f9c0d1e3a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Add profile_id column and foreign key to sync_device ───────────
    op.add_column(
        'sync_device',
        sa.Column('profile_id', sa.UUID(), nullable=True)
    )
    op.create_index(op.f('ix_sync_device_profile_id'), 'sync_device', ['profile_id'], unique=False)
    op.create_foreign_key(
        'fk_sync_device_profile_id_device_profiles',
        'sync_device',
        'device_profiles',
        ['profile_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # ── 2. Backfill existing sync_device records based on category ────────
    # Map 'lowcost' -> profile 'lowcost'
    op.execute("""
        UPDATE sync_device
        SET profile_id = (SELECT id FROM device_profiles WHERE name = 'lowcost' LIMIT 1)
        WHERE LOWER(category) = 'lowcost' OR category IS NULL;
    """)

    # Map 'gas' / 'lowcost_gas' -> profile 'lowcost_gas'
    op.execute("""
        UPDATE sync_device
        SET profile_id = (SELECT id FROM device_profiles WHERE name = 'lowcost_gas' LIMIT 1)
        WHERE LOWER(category) IN ('gas', 'lowcost_gas');
    """)

    # Map 'bam' -> profile 'bam'
    op.execute("""
        UPDATE sync_device
        SET profile_id = (SELECT id FROM device_profiles WHERE name = 'bam' LIMIT 1)
        WHERE LOWER(category) = 'bam';
    """)

    # ── 3. Drop legacy category table ─────────────────────────────────────
    op.drop_table('category')


def downgrade() -> None:
    # Re-create legacy category table
    op.create_table(
        'category',
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('level', sa.String(length=100), nullable=True),
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
        sa.PrimaryKeyConstraint('name'),
    )

    # Drop foreign key, index, and column profile_id from sync_device
    op.drop_constraint('fk_sync_device_profile_id_device_profiles', 'sync_device', type_='foreignkey')
    op.drop_index(op.f('ix_sync_device_profile_id'), table_name='sync_device')
    op.drop_column('sync_device', 'profile_id')
