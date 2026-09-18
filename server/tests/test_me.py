import unittest
from datetime import datetime, timezone
from uuid import UUID

from app.api.v1.endpoints.auth import get_authenticated_user
from app.core.security import create_access_token
from app.main import app
from app.models.user import User
from app.schemas.auth import UserResponse


def make_user() -> User:
    return User(
        id=UUID("12345678-1234-5678-1234-567812345678"),
        name="Asha Darukaa",
        email="asha@example.com",
        password_hash="stored-hash",
        role="user",
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )


class MeEndpointTests(unittest.TestCase):
    def test_me_route_is_exposed(self) -> None:
        self.assertIn("/api/v1/auth/me", app.openapi()["paths"])

    def test_valid_authenticated_user_is_returned_safely(self) -> None:
        user = make_user()
        token = create_access_token(user.id)

        authenticated_user = get_authenticated_user(user)
        response = UserResponse.model_validate(authenticated_user)

        self.assertEqual(response.id, user.id)
        self.assertEqual(response.email, user.email)
        self.assertEqual(response.role, user.role)
        self.assertTrue(response.is_active)
        self.assertNotIn("password_hash", response.model_dump())
        self.assertTrue(token)


if __name__ == "__main__":
    unittest.main()