"""allow non-admin user role

Revision ID: b6c7d8e9f0a1
Revises: f2905fce5a05
Create Date: 2026-09-18
"""

from typing import Sequence, Union

from alembic import op


revision: str = "b6c7d8e9f0a1"
down_revision: Union[str, Sequence[str], None] = "f2905fce5a05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_users_role_valid", "users", type_="check")
    op.create_check_constraint(
        "ck_users_role_valid",
        "users",
        "role IN ('admin', 'user')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_role_valid", "users", type_="check")
    op.create_check_constraint(
        "ck_users_role_valid",
        "users",
        "role IN ('admin')",
    )