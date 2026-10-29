"""Add vendor table and update device_profiles and sync_firmware

Revision ID: e7f8a9b0c1d2
Revises: 9c3d0e1f2a4b
Create Date: 2026-08-28 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7f8a9b0c1d2'
down_revision: Union[str, None] = '9c3d0e1f2a4b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Create vendor table ────────────────────────────────────────────
    op.create_table(
        'vendor',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_vendor_name'), 'vendor', ['name'], unique=True)

    # ── 2. Seed initial vendor entries ────────────────────────────────────
    op.execute("""
        INSERT INTO vendor (id, name, description, created_at, updated_at)
        VALUES 
            (gen_random_uuid(), 'AirQo', 'AirQo Air Quality Hardware and Sensor Platforms', now(), now()),
            (gen_random_uuid(), 'Met One Instruments', 'Met One Instruments Regulatory Reference Monitors', now(), now()),
            (gen_random_uuid(), 'Generic ColdChain', 'Cold Chain Ultra-low Refrigeration and Pharmaceutical Monitoring', now(), now())
        ON CONFLICT (name) DO NOTHING;
    """)

    # Populate any distinct existing vendor strings from device_profiles if present
    op.execute("""
        INSERT INTO vendor (id, name, created_at, updated_at)
        SELECT gen_random_uuid(), dp.vendor, now(), now()
        FROM (SELECT DISTINCT vendor FROM device_profiles WHERE vendor IS NOT NULL) dp
        ON CONFLICT (name) DO NOTHING;
    """)

    # ── 3. Add vendor_id foreign key column to device_profiles ────────────
    op.add_column(
        'device_profiles',
        sa.Column('vendor_id', sa.UUID(), nullable=True)
    )
    op.create_index(op.f('ix_device_profiles_vendor_id'), 'device_profiles', ['vendor_id'], unique=False)
    op.create_foreign_key(
        'fk_device_profiles_vendor_id_vendor',
        'device_profiles',
        'vendor',
        ['vendor_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # ── 4. Backfill device_profiles.vendor_id from vendor name ────────────
    op.execute("""
        UPDATE device_profiles dp
        SET vendor_id = v.id
        FROM vendor v
        WHERE dp.vendor IS NOT NULL AND LOWER(dp.vendor) = LOWER(v.name);
    """)

    # ── 5. Drop old vendor string and firmware_compatibility columns ──────
    op.drop_column('device_profiles', 'firmware_compatibility')
    op.drop_column('device_profiles', 'vendor')

    # ── 6. Add vendor_id foreign key column to sync_firmware ──────────────
    op.add_column(
        'sync_firmware',
        sa.Column('vendor_id', sa.UUID(), nullable=True)
    )
    op.create_index(op.f('ix_sync_firmware_vendor_id'), 'sync_firmware', ['vendor_id'], unique=False)
    op.create_foreign_key(
        'fk_sync_firmware_vendor_id_vendor',
        'sync_firmware',
        'vendor',
        ['vendor_id'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    # ── 1. Revert sync_firmware vendor_id ─────────────────────────────────
    op.drop_constraint('fk_sync_firmware_vendor_id_vendor', 'sync_firmware', type_='foreignkey')
    op.drop_index(op.f('ix_sync_firmware_vendor_id'), table_name='sync_firmware')
    op.drop_column('sync_firmware', 'vendor_id')

    # ── 2. Restore vendor and firmware_compatibility in device_profiles ───
    op.add_column('device_profiles', sa.Column('vendor', sa.String(length=100), nullable=True))
    op.add_column('device_profiles', sa.Column('firmware_compatibility', sa.String(length=100), nullable=True))

    # Restore vendor strings from vendor table
    op.execute("""
        UPDATE device_profiles dp
        SET vendor = v.name
        FROM vendor v
        WHERE dp.vendor_id = v.id;
    """)

    op.drop_constraint('fk_device_profiles_vendor_id_vendor', 'device_profiles', type_='foreignkey')
    op.drop_index(op.f('ix_device_profiles_vendor_id'), table_name='device_profiles')
    op.drop_column('device_profiles', 'vendor_id')

    # ── 3. Drop vendor table ──────────────────────────────────────────────
    op.drop_index(op.f('ix_vendor_name'), table_name='vendor')
    op.drop_table('vendor')
