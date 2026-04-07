"""add_sensor_averages_and_correlation_to_performance

Revision ID: 63e90283a822
Revises: 508f6b6bfc3a
Create Date: 2026-04-03 16:30:54.511842

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '63e90283a822'
down_revision: Union[str, None] = '508f6b6bfc3a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('sync_device_performance', sa.Column('s1_pm2_5_average', sa.Float(), nullable=True))
    op.add_column('sync_device_performance', sa.Column('s2_pm2_5_average', sa.Float(), nullable=True))
    op.add_column('sync_device_performance', sa.Column('correlation', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('sync_device_performance', 'correlation')
    op.drop_column('sync_device_performance', 's2_pm2_5_average')
    op.drop_column('sync_device_performance', 's1_pm2_5_average')
