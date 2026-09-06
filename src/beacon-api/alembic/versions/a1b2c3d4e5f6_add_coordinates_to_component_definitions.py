"""Add coordinates to component_definitions

Revision ID: a1b2c3d4e5f6
Revises: e7f8a9b0c1d2
Create Date: 2026-09-05 10:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'e7f8a9b0c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Add x_coordinate and y_coordinate to component_definitions ─────
    op.add_column(
        'component_definitions',
        sa.Column('x_coordinate', sa.Float(), nullable=True)
    )
    op.add_column(
        'component_definitions',
        sa.Column('y_coordinate', sa.Float(), nullable=True)
    )

    # ── 2. Backfill coordinates from existing metadata JSON if present ───
    op.execute("""
        UPDATE component_definitions
        SET x_coordinate = CAST(metadata->>'x_coordinate' AS DOUBLE PRECISION)
        WHERE x_coordinate IS NULL
          AND metadata IS NOT NULL
          AND metadata ? 'x_coordinate'
          AND metadata->>'x_coordinate' ~ '^-?[0-9]+(\.[0-9]+)?$';
    """)
    op.execute("""
        UPDATE component_definitions
        SET y_coordinate = CAST(metadata->>'y_coordinate' AS DOUBLE PRECISION)
        WHERE y_coordinate IS NULL
          AND metadata IS NOT NULL
          AND metadata ? 'y_coordinate'
          AND metadata->>'y_coordinate' ~ '^-?[0-9]+(\.[0-9]+)?$';
    """)


def downgrade() -> None:
    op.drop_column('component_definitions', 'y_coordinate')
    op.drop_column('component_definitions', 'x_coordinate')
