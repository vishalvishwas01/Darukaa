import unittest
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1.endpoints.projects import (
    create_project,
    create_site,
    delete_project,
    delete_site,
    get_project,
    get_site,
    list_projects,
    list_sites,
    update_project,
    update_site,
)
from app.models.project import Project
from app.models.site import Site
from app.models.user import User
from app.schemas.projects import ProjectCreate, ProjectUpdate
from app.schemas.sites import GeoJSONPolygon, SiteCreate, SiteUpdate
from app.main import app


USER_ID = UUID("12345678-1234-5678-1234-567812345678")
OTHER_USER_ID = UUID("87654321-4321-8765-4321-876543218765")
PROJECT_ID = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
SITE_ID = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")

VALID_BOUNDARY = {
    "type": "Polygon",
    "coordinates": [
        [
            [77.0, 28.0],
            [77.01, 28.0],
            [77.01, 28.01],
            [77.0, 28.0],
        ]
    ],
}


class ResultRows:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows

    def first(self):
        return self.rows[0] if self.rows else None


class ProjectSiteSession:
    def __init__(self, scalar_values=None, scalar_default=None, rows=None, projects=None):
        self.scalar_values = list(scalar_values or [])
        self.scalar_default = scalar_default
        self.rows = rows or []
        self.projects = projects or []
        self.added = []
        self.deleted = []
        self.commit_count = 0
        self.rollback_count = 0
        self.raise_database_error = False

    def scalar(self, _query):
        if self.raise_database_error:
            raise SQLAlchemyError("database unavailable")
        if self.scalar_values:
            return self.scalar_values.pop(0)
        return self.scalar_default

    def scalars(self, _query):
        if self.raise_database_error:
            raise SQLAlchemyError("database unavailable")
        return ResultRows(self.projects)

    def execute(self, _query):
        if self.raise_database_error:
            raise SQLAlchemyError("database unavailable")
        return ResultRows(self.rows)

    def add(self, value) -> None:
        self.added.append(value)

    def commit(self) -> None:
        self.commit_count += 1

    def refresh(self, value) -> None:
        if value.id is None:
            value.id = uuid4()
        now = datetime.now(timezone.utc)
        if value.created_at is None:
            value.created_at = now
        if value.updated_at is None:
            value.updated_at = now
        if isinstance(value, Project) and value.status is None:
            value.status = "active"

    def delete(self, value) -> None:
        self.deleted.append(value)

    def rollback(self) -> None:
        self.rollback_count += 1


def make_user(user_id=USER_ID) -> User:
    return User(
        id=user_id,
        name="Asha Darukaa",
        email="asha@example.com",
        password_hash="stored-hash",
        role="user",
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )


def make_project(owner_id=USER_ID) -> Project:
    now = datetime.now(timezone.utc)
    return Project(
        id=PROJECT_ID,
        owner_id=owner_id,
        name="Forest Project",
        description="Restoration work",
        project_type="reforestation",
        status="active",
        created_at=now,
        updated_at=now,
    )


def make_site(project_id=PROJECT_ID) -> Site:
    now = datetime.now(timezone.utc)
    return Site(
        id=SITE_ID,
        project_id=project_id,
        name="North Site",
        description="A test site",
        boundary=VALID_BOUNDARY,
        area_hectares=Decimal("12.3400"),
        created_at=now,
        updated_at=now,
    )


class ProjectApiTests(unittest.TestCase):
    def test_project_routes_are_exposed(self) -> None:
        paths = app.openapi()["paths"]
        self.assertIn("/api/v1/projects", paths)
        self.assertIn("/api/v1/projects/{project_id}", paths)

    def test_create_project_assigns_authenticated_owner_and_default_status(self) -> None:
        session = ProjectSiteSession()
        project = create_project(
            ProjectCreate(name="Forest Project", project_type="reforestation"),
            make_user(),
            session,
        )

        self.assertEqual(project.owner_id, USER_ID)
        self.assertEqual(project.status, "active")
        self.assertEqual(session.commit_count, 1)

    def test_client_cannot_submit_owner_id(self) -> None:
        with self.assertRaises(ValueError):
            ProjectCreate.model_validate(
                {
                    "name": "Forest Project",
                    "project_type": "reforestation",
                    "owner_id": str(OTHER_USER_ID),
                }
            )

    def test_list_projects_returns_only_session_query_results(self) -> None:
        session = ProjectSiteSession(projects=[make_project()])

        projects = list_projects(make_user(), session)

        self.assertEqual(projects, [session.projects[0]])

    def test_project_belonging_to_another_user_is_hidden(self) -> None:
        with self.assertRaises(HTTPException) as context:
            get_project(PROJECT_ID, make_user(), ProjectSiteSession())

        self.assertEqual(context.exception.status_code, 404)

    def test_project_update_and_empty_update_validation(self) -> None:
        project = make_project()
        session = ProjectSiteSession(scalar_values=[project])

        updated = update_project(
            PROJECT_ID,
            ProjectUpdate(name="Updated Project"),
            make_user(),
            session,
        )

        self.assertEqual(updated.name, "Updated Project")
        self.assertEqual(updated.owner_id, USER_ID)
        self.assertEqual(session.commit_count, 1)

        with self.assertRaises(ValueError):
            ProjectUpdate.model_validate({})

    def test_project_delete_commits_owned_project(self) -> None:
        project = make_project()
        session = ProjectSiteSession(scalar_values=[project])

        response = delete_project(PROJECT_ID, make_user(), session)

        self.assertEqual(response.status_code, 204)
        self.assertEqual(session.deleted, [project])
        self.assertEqual(session.commit_count, 1)


class SiteApiTests(unittest.TestCase):
    def test_site_routes_are_exposed(self) -> None:
        paths = app.openapi()["paths"]
        self.assertIn("/api/v1/projects/{project_id}/sites", paths)
        self.assertIn("/api/v1/projects/{project_id}/sites/{site_id}", paths)

    def test_create_site_uses_project_owner_and_server_area(self) -> None:
        project = make_project()
        session = ProjectSiteSession(
            scalar_values=[project, True, Decimal("12.3456")]
        )

        site = create_site(
            PROJECT_ID,
            SiteCreate(name="North Site", boundary=VALID_BOUNDARY),
            make_user(),
            session,
        )

        created_site = session.added[0]
        self.assertEqual(created_site.project_id, PROJECT_ID)
        self.assertEqual(created_site.area_hectares, Decimal("12.3456"))
        self.assertEqual(site.project_id, PROJECT_ID)

    def test_site_creation_requires_owned_project(self) -> None:
        with self.assertRaises(HTTPException) as context:
            create_site(
                PROJECT_ID,
                SiteCreate(name="North Site", boundary=VALID_BOUNDARY),
                make_user(),
                ProjectSiteSession(),
            )

        self.assertEqual(context.exception.status_code, 404)

    def test_site_list_and_detail_use_project_and_site_scope(self) -> None:
        project = make_project()
        site = make_site()
        session = ProjectSiteSession(
            scalar_values=[project, project],
            rows=[(site, VALID_BOUNDARY)],
        )

        sites = list_sites(PROJECT_ID, make_user(), session)
        detail = get_site(PROJECT_ID, SITE_ID, make_user(), session)

        self.assertEqual(sites[0].id, SITE_ID)
        self.assertEqual(detail.project_id, PROJECT_ID)

    def test_site_update_recalculates_area_without_changing_project(self) -> None:
        project = make_project()
        site = make_site()
        session = ProjectSiteSession(
            scalar_values=[project, site, True, Decimal("20.0000")],
            rows=[(site, VALID_BOUNDARY)],
        )
        updated_boundary = {
            "type": "Polygon",
            "coordinates": [
                [
                    [77.0, 28.0],
                    [77.02, 28.0],
                    [77.02, 28.02],
                    [77.0, 28.0],
                ]
            ],
        }

        updated = update_site(
            PROJECT_ID,
            SITE_ID,
            SiteUpdate(boundary=updated_boundary),
            make_user(),
            session,
        )

        self.assertEqual(site.project_id, PROJECT_ID)
        self.assertEqual(site.area_hectares, Decimal("20.0000"))
        self.assertEqual(updated.project_id, PROJECT_ID)

    def test_site_delete_commits_matching_site(self) -> None:
        project = make_project()
        site = make_site()
        session = ProjectSiteSession(scalar_values=[project, site])

        response = delete_site(PROJECT_ID, SITE_ID, make_user(), session)

        self.assertEqual(response.status_code, 204)
        self.assertEqual(session.deleted, [site])

    def test_invalid_polygon_shapes_are_rejected(self) -> None:
        invalid_boundaries = [
            {
                "type": "Point",
                "coordinates": [[77.0, 28.0]],
            },
            {
                "type": "Polygon",
                "coordinates": [[[77.0, 28.0], [77.01, 28.0], [77.0, 28.0]]],
            },
            {
                "type": "Polygon",
                "coordinates": [[[181.0, 28.0], [77.01, 28.0], [77.01, 28.01], [181.0, 28.0]]],
            },
        ]

        for boundary in invalid_boundaries:
            with self.subTest(boundary=boundary):
                with self.assertRaises(ValueError):
                    SiteCreate(name="Invalid", boundary=boundary)

    def test_unclosed_and_self_intersecting_polygons_are_rejected(self) -> None:
        unclosed = {
            "type": "Polygon",
            "coordinates": [[[77.0, 28.0], [77.01, 28.0], [77.01, 28.01], [77.0, 28.01]]],
        }
        self_intersecting = {
            "type": "Polygon",
            "coordinates": [[[77.0, 28.0], [77.01, 28.01], [77.0, 28.01], [77.01, 28.0], [77.0, 28.0]]],
        }

        with self.assertRaises(ValueError):
            SiteCreate(name="Unclosed", boundary=unclosed)
        with self.assertRaises(ValueError):
            SiteCreate(name="Self intersecting", boundary=self_intersecting)

    def test_site_update_rejects_empty_payload_and_area_override(self) -> None:
        with self.assertRaises(ValueError):
            SiteUpdate.model_validate({})
        with self.assertRaises(ValueError):
            SiteCreate.model_validate(
                {
                    "name": "North Site",
                    "boundary": VALID_BOUNDARY,
                    "area_hectares": 999,
                }
            )


if __name__ == "__main__":
    unittest.main()
