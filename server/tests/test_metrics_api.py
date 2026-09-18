import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1.endpoints.metrics import (
    create_metric,
    delete_metric,
    get_metric,
    list_metrics,
    project_analytics_summary,
    site_analytics_summary,
    site_analytics_timeseries,
    update_metric,
)
from app.main import app
from app.models.project import Project
from app.models.site import Site
from app.models.site_metric import SiteMetric
from app.models.user import User
from app.schemas.metrics import SiteMetricCreate, SiteMetricUpdate


USER_ID = UUID("12345678-1234-5678-1234-567812345678")
PROJECT_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
SITE_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
METRIC_ID = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")


class Rows:
    def __init__(self, values):
        self.values = values

    def all(self):
        return self.values

    def first(self):
        return self.values[0] if self.values else None

    def one(self):
        if len(self.values) != 1:
            raise AssertionError("expected one result")
        return self.values[0]


class MetricSession:
    def __init__(self, scalar_values=None, scalars_values=None, execute_values=None):
        self.scalar_values = list(scalar_values or [])
        self.scalars_values = list(scalars_values or [])
        self.execute_values = list(execute_values or [])
        self.added = []
        self.deleted = []
        self.commits = 0
        self.rollbacks = 0

    def scalar(self, _query):
        return self.scalar_values.pop(0) if self.scalar_values else None

    def scalars(self, _query):
        return Rows(self.scalars_values.pop(0) if self.scalars_values else [])

    def execute(self, _query):
        return Rows(self.execute_values.pop(0) if self.execute_values else [])

    def add(self, value):
        self.added.append(value)

    def delete(self, value):
        self.deleted.append(value)

    def commit(self):
        self.commits += 1

    def refresh(self, value):
        value.id = value.id or METRIC_ID
        value.created_at = value.created_at or datetime.now(timezone.utc)

    def rollback(self):
        self.rollbacks += 1


def user() -> User:
    return User(
        id=USER_ID,
        name="Asha",
        email="asha@example.com",
        password_hash="hash",
        role="user",
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )


def project() -> Project:
    now = datetime.now(timezone.utc)
    return Project(
        id=PROJECT_ID,
        owner_id=USER_ID,
        name="Forest",
        project_type="reforestation",
        status="active",
        created_at=now,
        updated_at=now,
    )


def site() -> Site:
    return Site(id=SITE_ID, project_id=PROJECT_ID, name="North")


def metric(
    *,
    metric_name: str = "carbon_stock",
    value: str = "10.50",
    recorded_at: datetime | None = None,
) -> SiteMetric:
    return SiteMetric(
        id=METRIC_ID,
        site_id=SITE_ID,
        metric_name=metric_name,
        metric_value=Decimal(value),
        unit="tonnes",
        recorded_at=recorded_at or datetime(2026, 1, 1, tzinfo=timezone.utc),
        created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )


def metric_input(**overrides) -> SiteMetricCreate:
    values = {
        "metric_name": "carbon_stock",
        "metric_value": Decimal("10.5"),
        "unit": "tonnes",
        "recorded_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
    }
    values.update(overrides)
    return SiteMetricCreate(**values)


class MetricCrudTests(unittest.TestCase):
    def test_metric_routes_are_exposed(self):
        paths = app.openapi()["paths"]
        self.assertIn("/api/v1/projects/{project_id}/sites/{site_id}/metrics", paths)
        self.assertIn("/api/v1/projects/{project_id}/sites/{site_id}/metrics/{metric_id}", paths)

    def test_create_metric_derives_site_id_from_url(self):
        session = MetricSession(scalar_values=[site()])
        created = create_metric(PROJECT_ID, SITE_ID, metric_input(), user(), session)

        self.assertEqual(session.added[0].site_id, SITE_ID)
        self.assertEqual(created.site_id, SITE_ID)
        self.assertEqual(session.commits, 1)

    def test_create_metric_missing_site_returns_404(self):
        with self.assertRaises(HTTPException) as context:
            create_metric(PROJECT_ID, SITE_ID, metric_input(), user(), MetricSession())
        self.assertEqual(context.exception.status_code, 404)

    def test_get_update_delete_metric_are_scoped(self):
        existing = metric()
        session = MetricSession(scalar_values=[existing])
        self.assertIs(get_metric(PROJECT_ID, SITE_ID, METRIC_ID, user(), session), existing)

        session = MetricSession(scalar_values=[existing])
        updated = update_metric(
            PROJECT_ID,
            SITE_ID,
            METRIC_ID,
            SiteMetricUpdate(metric_value=Decimal("12.5")),
            user(),
            session,
        )
        self.assertEqual(updated.metric_value, Decimal("12.5"))

        session = MetricSession(scalar_values=[existing])
        response = delete_metric(PROJECT_ID, SITE_ID, METRIC_ID, user(), session)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(session.deleted, [existing])

    def test_wrong_site_or_missing_metric_returns_404(self):
        with self.assertRaises(HTTPException) as context:
            get_metric(PROJECT_ID, SITE_ID, METRIC_ID, user(), MetricSession())
        self.assertEqual(context.exception.status_code, 404)

    def test_database_errors_rollback_and_hide_details(self):
        session = MetricSession()
        original_scalar = session.scalar
        session.scalar = lambda _query: (_ for _ in ()).throw(SQLAlchemyError("secret db detail"))

        with self.assertRaises(HTTPException) as context:
            create_metric(PROJECT_ID, SITE_ID, metric_input(), user(), session)

        self.assertEqual(context.exception.status_code, 500)
        self.assertEqual(session.rollbacks, 1)
        session.scalar = original_scalar


class MetricFilteringTests(unittest.TestCase):
    def test_list_metrics_supports_filters_pagination_and_order(self):
        rows = [metric(recorded_at=datetime(2026, 1, 1, tzinfo=timezone.utc))]
        session = MetricSession(
            scalar_values=[site(), 1],
            scalars_values=[rows],
        )
        page = list_metrics(
            PROJECT_ID,
            SITE_ID,
            metric_name="carbon_stock",
            start_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
            end_date=datetime(2026, 1, 2, tzinfo=timezone.utc),
            limit=10,
            offset=0,
            current_user=user(),
            db=session,
        )
        self.assertEqual(page.total, 1)
        self.assertEqual(page.items[0].metric_name, "carbon_stock")

    def test_reversed_date_range_is_rejected(self):
        with self.assertRaises(HTTPException) as context:
            list_metrics(
                PROJECT_ID,
                SITE_ID,
                start_date=datetime(2026, 2, 1, tzinfo=timezone.utc),
                end_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
                current_user=user(),
                db=MetricSession(),
            )
        self.assertEqual(context.exception.status_code, 422)

    def test_invalid_metric_payloads_are_rejected(self):
        with self.assertRaises(ValueError):
            SiteMetricCreate.model_validate(
                {
                    "metric_name": "",
                    "metric_value": "NaN",
                    "unit": "",
                    "recorded_at": "not-a-date",
                }
            )
        with self.assertRaises(ValueError):
            SiteMetricCreate.model_validate(
                {
                    "metric_name": "carbon_stock",
                    "metric_value": "Infinity",
                    "unit": "tonnes",
                    "recorded_at": "2026-01-01T00:00:00Z",
                }
            )
        with self.assertRaises(ValueError):
            SiteMetricCreate.model_validate(
                {
                    "metric_name": "carbon_stock",
                    "metric_value": 1,
                    "unit": "tonnes",
                    "recorded_at": "2026-01-01T00:00:00Z",
                    "site_id": str(SITE_ID),
                }
            )

    def test_empty_metric_update_is_rejected(self):
        with self.assertRaises(ValueError):
            SiteMetricUpdate.model_validate({})


class AnalyticsTests(unittest.TestCase):
    def test_site_summary_aggregates_metrics(self):
        summary_rows = [type("Summary", (), {
            "metric_name": "carbon_stock",
            "unit": "tonnes",
            "record_count": 2,
            "minimum_value": Decimal("10"),
            "maximum_value": Decimal("20"),
            "average_value": Decimal("15"),
        })()]
        latest_rows = [type("Latest", (), {
            "metric_name": "carbon_stock",
            "unit": "tonnes",
            "latest_value": Decimal("20"),
            "latest_recorded_at": datetime(2026, 2, 1, tzinfo=timezone.utc),
        })()]
        session = MetricSession(
            scalar_values=[site(), 2],
            scalars_values=[["carbon_stock"]],
            execute_values=[
                [(datetime(2026, 1, 1, tzinfo=timezone.utc), datetime(2026, 2, 1, tzinfo=timezone.utc))],
                summary_rows,
                latest_rows,
            ],
        )
        result = site_analytics_summary(PROJECT_ID, SITE_ID, user(), session)
        self.assertEqual(result.total_metric_records, 2)
        self.assertEqual(result.metrics[0].average_value, Decimal("15"))
        self.assertEqual(result.metrics[0].latest_value, Decimal("20"))

    def test_project_summary_aggregates_owned_sites(self):
        summary_rows = [type("Summary", (), {
            "metric_name": "carbon_stock",
            "unit": "tonnes",
            "record_count": 2,
            "minimum_value": Decimal("10"),
            "maximum_value": Decimal("20"),
            "average_value": Decimal("15"),
        })()]
        latest_rows = [type("Latest", (), {
            "metric_name": "carbon_stock",
            "unit": "tonnes",
            "latest_value": Decimal("20"),
            "latest_recorded_at": datetime(2026, 2, 1, tzinfo=timezone.utc),
        })()]
        session = MetricSession(
            scalar_values=[project(), 2],
            scalars_values=[[SITE_ID], ["carbon_stock"]],
            execute_values=[
                summary_rows,
                latest_rows,
                [(SITE_ID, 2)],
            ],
        )

        result = project_analytics_summary(PROJECT_ID, user(), session)

        self.assertEqual(result.total_sites, 1)
        self.assertEqual(result.total_metric_records, 2)
        self.assertEqual(result.site_record_counts[0].site_id, SITE_ID)
        self.assertEqual(result.metrics[0].record_count, 2)

    def test_timeseries_returns_chronological_points_and_empty_is_safe(self):
        first = metric(recorded_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
        second = metric(recorded_at=datetime(2026, 2, 1, tzinfo=timezone.utc))
        session = MetricSession(
            scalar_values=[site()],
            scalars_values=[[first, second]],
        )
        result = site_analytics_timeseries(
            PROJECT_ID,
            SITE_ID,
            metric_name="carbon_stock",
            limit=1000,
            current_user=user(),
            db=session,
        )
        self.assertEqual(len(result.points), 2)
        self.assertLess(result.points[0].recorded_at, result.points[1].recorded_at)

        empty = MetricSession(scalar_values=[site()], scalars_values=[[]])
        empty_result = site_analytics_timeseries(
            PROJECT_ID,
            SITE_ID,
            metric_name="carbon_stock",
            limit=1000,
            current_user=user(),
            db=empty,
        )
        self.assertEqual(empty_result.points, [])

    def test_project_summary_rejects_unowned_project(self):
        with self.assertRaises(HTTPException) as context:
            project_analytics_summary(PROJECT_ID, user(), MetricSession())
        self.assertEqual(context.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
