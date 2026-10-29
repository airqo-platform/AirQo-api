"""Add daily device diagnostics and issue tables

Revision ID: b8c9d0e1f2a3
Revises: a1b2c3d4e5f6
Create Date: 2026-09-13 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'device_daily_diagnostics',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('device_id', sa.String(length=100), nullable=False),
        sa.Column('channel_id', sa.String(length=50), nullable=True),
        sa.Column('diagnosis_date', sa.Date(), nullable=False),
        sa.Column('profile_id', sa.UUID(), nullable=True),
        sa.Column('record_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('hours_with_data', sa.Integer(), server_default='0', nullable=False),
        sa.Column('first_record_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_record_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('overall_health_score', sa.Float(), nullable=False),
        sa.Column('lifecycle_state', sa.String(length=30), nullable=False),
        sa.Column('subsystem_scores', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('active_evidences', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('detected_symptoms', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('top_diagnoses', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('top_cause_code', sa.String(length=255), nullable=True),
        sa.Column('issue_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('max_severity', sa.String(length=20), nullable=True),
        sa.Column('resolved_issue_codes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('metrics_summary', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('engine_version', sa.String(length=20), nullable=True),
        sa.Column('evaluated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['sync_device.device_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['profile_id'], ['device_profiles.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('device_id', 'diagnosis_date', name='uq_daily_diag_device_date'),
    )
    op.create_index(op.f('ix_device_daily_diagnostics_device_id'), 'device_daily_diagnostics', ['device_id'], unique=False)
    op.create_index(op.f('ix_device_daily_diagnostics_diagnosis_date'), 'device_daily_diagnostics', ['diagnosis_date'], unique=False)
    op.create_index(op.f('ix_device_daily_diagnostics_top_cause_code'), 'device_daily_diagnostics', ['top_cause_code'], unique=False)
    op.create_index('ix_daily_diag_date_state', 'device_daily_diagnostics', ['diagnosis_date', 'lifecycle_state'], unique=False)

    op.create_table(
        'device_daily_issues',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('daily_diagnostic_id', sa.UUID(), nullable=False),
        sa.Column('device_id', sa.String(length=100), nullable=False),
        sa.Column('diagnosis_date', sa.Date(), nullable=False),
        sa.Column('issue_code', sa.String(length=255), nullable=False),
        sa.Column('check_type', sa.String(length=50), nullable=False),
        sa.Column('component_name', sa.String(length=100), nullable=True),
        sa.Column('metric_key', sa.String(length=255), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('subsystem', sa.String(length=50), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('value', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_new', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('streak_days', sa.Integer(), server_default='1', nullable=False),
        sa.Column('streak_start_date', sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(['daily_diagnostic_id'], ['device_daily_diagnostics.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('device_id', 'diagnosis_date', 'issue_code', name='uq_daily_issue_device_date_code'),
    )
    op.create_index(op.f('ix_device_daily_issues_daily_diagnostic_id'), 'device_daily_issues', ['daily_diagnostic_id'], unique=False)
    op.create_index(op.f('ix_device_daily_issues_device_id'), 'device_daily_issues', ['device_id'], unique=False)
    op.create_index('ix_daily_issue_code_date', 'device_daily_issues', ['issue_code', 'diagnosis_date'], unique=False)
    op.create_index('ix_daily_issue_date_severity', 'device_daily_issues', ['diagnosis_date', 'severity'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_daily_issue_date_severity', table_name='device_daily_issues')
    op.drop_index('ix_daily_issue_code_date', table_name='device_daily_issues')
    op.drop_index(op.f('ix_device_daily_issues_device_id'), table_name='device_daily_issues')
    op.drop_index(op.f('ix_device_daily_issues_daily_diagnostic_id'), table_name='device_daily_issues')
    op.drop_table('device_daily_issues')
    op.drop_index('ix_daily_diag_date_state', table_name='device_daily_diagnostics')
    op.drop_index(op.f('ix_device_daily_diagnostics_top_cause_code'), table_name='device_daily_diagnostics')
    op.drop_index(op.f('ix_device_daily_diagnostics_diagnosis_date'), table_name='device_daily_diagnostics')
    op.drop_index(op.f('ix_device_daily_diagnostics_device_id'), table_name='device_daily_diagnostics')
    op.drop_table('device_daily_diagnostics')
