import unittest
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1.endpoints.auth import login_user
from app.core.security import decode_access_token, hash_password
from app.main import app
from app.models.user import User
from app.schemas.auth import TokenResponse, UserLogin


class LoginSession:
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


def make_user(
    *,
    email: str = "asha@example.com",
    password: str = "a-secure-password",
    is_active: bool = True,
) -> User:
    return User(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        name="Asha Darukaa",
        email=email,
        password_hash=hash_password(password),
        role="user",
        is_active=is_active,
        created_at=datetime.now(timezone.utc),
    )


class LoginApiTests(unittest.TestCase):
    def test_login_route_is_exposed(self) -> None:
        self.assertIn("/api/v1/auth/login", app.openapi()["paths"])

    def test_successful_login_returns_bearer_token_for_user_id(self) -> None:
        user = make_user()

        response = login_user(
            UserLogin(email=" ASHA@Example.COM ", password="a-secure-password"),
            LoginSession(user),
        )

        self.assertIsInstance(response, TokenResponse)
        self.assertEqual(response.token_type, "bearer")
        payload = decode_access_token(response.access_token)
        self.assertEqual(payload["sub"], str(user.id))

    def test_incorrect_password_returns_generic_unauthorized_error(self) -> None:
        self.assert_authentication_failure("wrong-password", make_user())

    def test_unknown_email_returns_same_generic_error(self) -> None:
        self.assert_authentication_failure(
            "a-secure-password",
            LoginSession(),
        )

    def test_inactive_user_returns_same_generic_error(self) -> None:
        self.assert_authentication_failure(
            "a-secure-password",
            make_user(is_active=False),
        )

    def test_database_error_rolls_back_and_returns_server_error(self) -> None:
        session = LoginSession()
        session.raise_database_error = True

        with self.assertRaises(HTTPException) as context:
            login_user(
                UserLogin(email="asha@example.com", password="a-secure-password"),
                session,
            )

        self.assertEqual(context.exception.status_code, 500)
        self.assertTrue(session.rollback_called)

    def test_missing_login_fields_are_rejected(self) -> None:
        for payload in ({}, {"email": "asha@example.com"}, {"password": "a-secure-password"}):
            with self.subTest(payload=payload):
                with self.assertRaises(ValueError):
                    UserLogin.model_validate(payload)

    def assert_authentication_failure(self, password: str, session_or_user) -> None:
        session = (
            session_or_user
            if isinstance(session_or_user, LoginSession)
            else LoginSession(session_or_user)
        )

        with self.assertRaises(HTTPException) as context:
            login_user(
                UserLogin(email="asha@example.com", password=password),
                session,
            )

        self.assertEqual(context.exception.status_code, 401)
        self.assertEqual(context.exception.detail, "Invalid email or password.")


if __name__ == "__main__":
    unittest.main()