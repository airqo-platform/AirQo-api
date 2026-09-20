"""Add metric roles, relationship metadata and daily diagnostic indicators

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-09-17 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c9d0e1f2a3b4'
down_revision: Union[str, None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Which metric plays which part for the engine: charge_level, charge_source, signal_strength
    op.add_column('metric_definitions', sa.Column('role', sa.String(length=50), nullable=True))
    # Per-relationship settings, e.g. {"tolerance": {"absolute": 10, "relative": 0.2}} on MEASURES_SAME_AS
    op.add_column('component_relationships', sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    # Continuous per-component measurements (charge cycle, coverage, sensor agreement) for each diagnosed day
    op.add_column('device_daily_diagnostics', sa.Column('indicators', postgresql.JSONB(astext_type=sa.Text()), nullable=True))

    # Existing battery voltage metrics are the charge level of their battery component.
    op.execute(
        """
        UPDATE metric_definitions m
        SET role = 'charge_level'
        FROM component_definitions c
        WHERE m.component_id = c.id
          AND m.role IS NULL
          AND lower(c.component_type) = 'battery'
          AND lower(coalesce(m.unit, '')) = 'v'
        """
    )


def downgrade() -> None:
    op.drop_column('device_daily_diagnostics', 'indicators')
    op.drop_column('component_relationships', 'metadata')
    op.drop_column('metric_definitions', 'role')
