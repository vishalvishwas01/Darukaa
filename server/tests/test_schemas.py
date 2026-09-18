import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import UUID

from pydantic import ValidationError

from app.schemas.auth import TokenResponse, UserLogin, UserRegistration, UserResponse


class AuthenticationSchemaTests(unittest.TestCase):
    def test_registration_normalizes_email_and_name(self) -> None:
        registration = UserRegistration(
            name="  Asha Darukaa  ",
            email="  ASHA@Example.COM ",
            password="a-secure-password",
        )

        self.assertEqual(registration.name, "Asha Darukaa")
        self.assertEqual(registration.email, "asha@example.com")
        self.assertNotIn("role", registration.model_fields_set)
        self.assertNotIn("password_hash", registration.model_dump())

    def test_login_normalizes_email(self) -> None:
        login = UserLogin(email=" USER@Example.COM ", password="a-secure-password")

        self.assertEqual(login.email, "user@example.com")

    def test_invalid_email_is_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            UserRegistration(
                name="Asha",
                email="not-an-email",
                password="a-secure-password",
            )

    def test_empty_or_short_password_is_rejected(self) -> None:
        for password in ("", "short"):
            with self.subTest(password_length=len(password)):
                with self.assertRaises(ValidationError):
                    UserRegistration(
                        name="Asha",
                        email="asha@example.com",
                        password=password,
                    )

    def test_registration_role_is_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            UserRegistration(
                name="Asha",
                email="asha@example.com",
                password="a-secure-password",
                role="admin",
            )

    def test_user_response_excludes_sensitive_fields(self) -> None:
        user = SimpleNamespace(
            id=UUID("12345678-1234-5678-1234-567812345678"),
            name="Asha",
            email="asha@example.com",
            password_hash="not-returned",
            role="admin",
            is_active=True,
            created_at=datetime.now(timezone.utc),
        )

        response = UserResponse.model_validate(user)

        self.assertNotIn("password_hash", response.model_dump())
        self.assertEqual(response.email, "asha@example.com")

    def test_token_response_contains_only_token_fields(self) -> None:
        response = TokenResponse(access_token="token-value", token_type="bearer")

        self.assertEqual(response.token_type, "bearer")
        self.assertEqual(set(response.model_dump()), {"access_token", "token_type"})


if __name__ == "__main__":
    unittest.main()
