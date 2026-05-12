"""add sync_group and sync_group_cohort tables

Revision ID: f6a2b3c4d5e6
Revises: 3410806a12d5
Create Date: 2026-05-11 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a2b3c4d5e6'
down_revision: Union[str, None] = '3410806a12d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('sync_group',
        sa.Column('group_id', sa.String(length=100), nullable=False),
        sa.Column('grp_title', sa.String(length=255), nullable=False),
        sa.Column('grp_status', sa.String(length=50), nullable=True),
        sa.Column('organization_slug', sa.String(length=255), nullable=True),
        sa.Column('grp_website', sa.String(length=255), nullable=True),
        sa.Column('grp_industry', sa.String(length=255), nullable=True),
        sa.Column('grp_country', sa.String(length=255), nullable=True),
        sa.Column('grp_timezone', sa.String(length=255), nullable=True),
        sa.Column('grp_profile_picture', sa.String(length=500), nullable=True),
        sa.Column('number_of_users', sa.Integer(), server_default='0', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('group_id'),
    )
    op.create_index(op.f('ix_sync_group_grp_title'), 'sync_group', ['grp_title'], unique=True)

    op.create_table('sync_group_cohort',
        sa.Column('group_id', sa.String(length=100), nullable=False),
        sa.Column('cohort_id', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['group_id'], ['sync_group.group_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['cohort_id'], ['sync_cohort.cohort_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('group_id', 'cohort_id'),
    )


def downgrade() -> None:
    op.drop_table('sync_group_cohort')
    op.drop_index(op.f('ix_sync_group_grp_title'), table_name='sync_group')
    op.drop_table('sync_group')
