import unittest
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.main import app
from app.api.v1.endpoints.auth import register_user
from app.models.user import User
from app.schemas.auth import UserRegistration, UserResponse


class FakeSession:
    def __init__(self, existing_user: User | None = None) -> None:
        self.existing_user = existing_user
        self.added_user: User | None = None
        self.rollback_called = False
        self.raise_integrity_error = False

    def scalar(self, _query):
        return self.existing_user

    def add(self, user: User) -> None:
        self.added_user = user

    def commit(self) -> None:
        if self.raise_integrity_error:
            raise IntegrityError("insert", {}, Exception("duplicate"))

    def refresh(self, user: User) -> None:
        user.id = user.id or uuid4()
        user.created_at = user.created_at or datetime.now(timezone.utc)

    def rollback(self) -> None:
        self.rollback_called = True


class RegistrationApiTests(unittest.TestCase):
    def test_registration_route_is_exposed(self) -> None:
        self.assertIn("/api/v1/auth/register", app.openapi()["paths"])

    def test_successful_registration_hashes_password_and_excludes_it(self) -> None:
        session = FakeSession()
        user = register_user(
            UserRegistration(
                name="Asha Darukaa",
                email=" ASHA@Example.COM ",
                password="a-secure-password",
            ),
            session,
        )
        response = UserResponse.model_validate(user)

        self.assertEqual(response.email, "asha@example.com")
        self.assertEqual(response.role, "user")
        self.assertNotIn("password_hash", response.model_dump())
        self.assertIsNotNone(session.added_user)
        self.assertNotEqual(
            session.added_user.password_hash,
            "a-secure-password",
        )
        self.assertTrue(session.added_user.password_hash.startswith("$2"))

    def test_duplicate_email_returns_conflict(self) -> None:
        existing_user = User(
            id=UUID("12345678-1234-5678-1234-567812345678"),
            name="Existing User",
            email="asha@example.com",
            password_hash="stored-hash",
            role="user",
            is_active=True,
            created_at=datetime.now(timezone.utc),
        )
        session = FakeSession(existing_user)
        with self.assertRaises(HTTPException) as context:
            register_user(
                UserRegistration(
                    name="Asha",
                    email="asha@example.com",
                    password="a-secure-password",
                ),
                session,
            )

        self.assertEqual(context.exception.status_code, 409)
        self.assertEqual(
            context.exception.detail,
            "An account with this email already exists.",
        )

    def test_integrity_error_rolls_back_and_returns_conflict(self) -> None:
        session = FakeSession()
        session.raise_integrity_error = True
        with self.assertRaises(HTTPException) as context:
            register_user(
                UserRegistration(
                    name="Asha",
                    email="asha@example.com",
                    password="a-secure-password",
                ),
                session,
            )

        self.assertEqual(context.exception.status_code, 409)
        self.assertTrue(session.rollback_called)

    def test_invalid_email_weak_password_and_missing_fields_are_rejected(self) -> None:
        for payload in (
            {
                "name": "Asha",
                "email": "not-an-email",
                "password": "a-secure-password",
            },
            {
                "name": "Asha",
                "email": "asha@example.com",
                "password": "short",
            },
            {"email": "asha@example.com"},
        ):
            with self.subTest(payload=payload):
                with self.assertRaises(ValueError):
                    UserRegistration.model_validate(payload)

    def test_client_cannot_choose_admin_role(self) -> None:
        with self.assertRaises(ValueError):
            UserRegistration.model_validate(
                {
                    "name": "Asha",
                    "email": "asha@example.com",
                    "password": "a-secure-password",
                    "role": "admin",
                }
            )

    def test_password_over_72_utf8_bytes_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            UserRegistration.model_validate(
                {
                    "name": "Asha",
                    "email": "asha@example.com",
                    "password": "é" * 37,
                }
            )


if __name__ == "__main__":
    unittest.main()
