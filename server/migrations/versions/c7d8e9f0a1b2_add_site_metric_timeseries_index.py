"""add site metric time-series index

Revision ID: c7d8e9f0a1b2
Revises: b6c7d8e9f0a1
Create Date: 2026-09-18
"""

from typing import Sequence, Union

from alembic import op


revision: str = "c7d8e9f0a1b2"
down_revision: Union[str, Sequence[str], None] = "b6c7d8e9f0a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_site_metrics_site_metric_recorded_at",
        "site_metrics",
        ["site_id", "metric_name", "recorded_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_site_metrics_site_metric_recorded_at",
        table_name="site_metrics",
    )