"""remove redundant site metric index

Revision ID: d8e9f0a1b2c3
Revises: c7d8e9f0a1b2
Create Date: 2026-09-18
"""

from typing import Sequence, Union

from alembic import op


revision: str = "d8e9f0a1b2c3"
down_revision: Union[str, Sequence[str], None] = "c7d8e9f0a1b2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_site_metrics_site_id", table_name="site_metrics")


def downgrade() -> None:
    op.create_index(
        "ix_site_metrics_site_id",
        "site_metrics",
        ["site_id"],
        unique=False,
    )