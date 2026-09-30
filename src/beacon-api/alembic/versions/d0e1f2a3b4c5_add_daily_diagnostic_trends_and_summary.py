"""Add trends, headline and summary to daily device diagnostics

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-09-19 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd0e1f2a3b4c5'
down_revision: Union[str, None] = 'c9d0e1f2a3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Multi-day trends of the day's indicators (degrading / improving / stable)
    op.add_column('device_daily_diagnostics', sa.Column('trends', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    # Plain-language description of the day
    op.add_column('device_daily_diagnostics', sa.Column('headline', sa.String(length=300), nullable=True))
    op.add_column('device_daily_diagnostics', sa.Column('summary', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('device_daily_diagnostics', 'summary')
    op.drop_column('device_daily_diagnostics', 'headline')
    op.drop_column('device_daily_diagnostics', 'trends')
