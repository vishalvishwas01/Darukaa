import unittest
from datetime import datetime, timedelta, timezone
from uuid import UUID
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.exc import SQLAlchemyError

from app.api.deps import get_current_user, require_admin
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.user import User


class DependencySession:
    def __init__(self, user: User | None = None) -> None:
        self.user = user
        self.rollback_called = False
        self.raise_database_error = False

    def scalar(self, _query):
        if self.raise_database_error:
            raise SQLAlchemyError("database unavailable")
        return self.user

    def rollback(self) -> None:
        self.rollback_called = True

    def close(self) -> None:
        self.closed = True


def make_user(*, is_active: bool = True, role: str = "user") -> User:
    return User(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        name="Asha Darukaa",
        email="asha@example.com",
        password_hash="stored-hash",
        role=role,
        is_active=is_active,
        created_at=datetime.now(timezone.utc),
    )


def credentials_for(token: str, scheme: str = "Bearer") -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme=scheme, credentials=token)


class AuthenticationDependencyTests(unittest.TestCase):
    def test_canonical_database_dependency_closes_session(self) -> None:
        session = DependencySession()
        with patch("app.db.session.SessionLocal", return_value=session):
            database = get_db()
            self.assertIs(next(database), session)
            database.close()

        self.assertTrue(session.closed)

    def test_missing_token_is_rejected(self) -> None:
        with self.assertRaises(HTTPException) as context:
            get_current_user(None, DependencySession())

        self.assertEqual(context.exception.status_code, 401)
        self.assertEqual(context.exception.headers["WWW-Authenticate"], "Bearer")

    def test_invalid_token_is_rejected(self) -> None:
        with self.assertRaises(HTTPException) as context:
            get_current_user(
                credentials_for("not-a-token"),
                DependencySession(),
            )

        self.assertEqual(context.exception.status_code, 401)

    def test_malformed_authorization_scheme_is_rejected(self) -> None:
        token = create_access_token(make_user().id)

        with self.assertRaises(HTTPException) as context:
            get_current_user(
                credentials_for(token, scheme="Basic"),
                DependencySession(),
            )

        self.assertEqual(context.exception.status_code, 401)

    def test_expired_token_is_rejected(self) -> None:
        token = create_access_token(
            make_user().id,
            expires_delta=timedelta(seconds=-1),
        )

        with self.assertRaises(HTTPException) as context:
            get_current_user(credentials_for(token), DependencySession())

        self.assertEqual(context.exception.status_code, 401)

    def test_valid_token_resolves_active_user(self) -> None:
        user = make_user()
        token = create_access_token(user.id)

        resolved_user = get_current_user(
            credentials_for(token),
            DependencySession(user),
        )

        self.assertIs(resolved_user, user)

    def test_invalid_uuid_subject_is_rejected(self) -> None:
        token = create_access_token("not-a-uuid")

        with self.assertRaises(HTTPException) as context:
            get_current_user(credentials_for(token), DependencySession())

        self.assertEqual(context.exception.status_code, 401)

    def test_nonexistent_user_is_rejected(self) -> None:
        token = create_access_token(make_user().id)

        with self.assertRaises(HTTPException) as context:
            get_current_user(credentials_for(token), DependencySession())

        self.assertEqual(context.exception.status_code, 401)

    def test_inactive_user_is_rejected(self) -> None:
        user = make_user(is_active=False)
        token = create_access_token(user.id)

        with self.assertRaises(HTTPException) as context:
            get_current_user(credentials_for(token), DependencySession(user))

        self.assertEqual(context.exception.status_code, 401)

    def test_inactive_admin_is_rejected(self) -> None:
        user = make_user(is_active=False, role="admin")
        token = create_access_token(user.id)

        with self.assertRaises(HTTPException) as context:
            get_current_user(credentials_for(token), DependencySession(user))

        self.assertEqual(context.exception.status_code, 401)

    def test_unauthenticated_admin_access_is_rejected(self) -> None:
        with self.assertRaises(HTTPException) as context:
            get_current_user(None, DependencySession())

        self.assertEqual(context.exception.status_code, 401)

    def test_database_error_is_hidden_and_rolled_back(self) -> None:
        session = DependencySession()
        session.raise_database_error = True
        token = create_access_token(make_user().id)

        with self.assertRaises(HTTPException) as context:
            get_current_user(credentials_for(token), session)

        self.assertEqual(context.exception.status_code, 500)
        self.assertTrue(session.rollback_called)

    def test_admin_dependency_checks_database_role(self) -> None:
        admin = make_user(role="admin")
        self.assertIs(require_admin(admin), admin)

        with self.assertRaises(HTTPException) as context:
            require_admin(make_user(role="user"))

        self.assertEqual(context.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()