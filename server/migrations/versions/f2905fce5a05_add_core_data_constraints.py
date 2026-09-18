"""add core data constraints

Revision ID: f2905fce5a05
Revises: e024edfd8337
Create Date: 2026-09-18
"""

from typing import Sequence, Union

from alembic import op


# Revision identifiers, used by Alembic.
revision: str = "f2905fce5a05"
down_revision: Union[str, Sequence[str], None] = "e024edfd8337"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_sites_area_non_negative",
        "sites",
        "area_hectares IS NULL OR area_hectares >= 0",
    )

    op.create_check_constraint(
        "ck_projects_status_valid",
        "projects",
        "status IN ('active', 'archived', 'draft')",
    )

    op.create_check_constraint(
        "ck_users_role_valid",
        "users",
        "role IN ('admin')",
    )

    op.create_check_constraint(
        "ck_site_metrics_value_non_negative",
        "site_metrics",
        "metric_value >= 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_site_metrics_value_non_negative",
        "site_metrics",
        type_="check",
    )

    op.drop_constraint(
        "ck_users_role_valid",
        "users",
        type_="check",
    )

    op.drop_constraint(
        "ck_projects_status_valid",
        "projects",
        type_="check",
    )

    op.drop_constraint(
        "ck_sites_area_non_negative",
        "sites",
        type_="check",
    )