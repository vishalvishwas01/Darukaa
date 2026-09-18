import unittest
from datetime import timedelta
from uuid import UUID

from jose import jwt

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


class PasswordSecurityTests(unittest.TestCase):
    def test_password_can_be_hashed_and_verified(self) -> None:
        password = "correct horse battery staple"
        password_hash = hash_password(password)

        self.assertNotEqual(password_hash, password)
        self.assertTrue(verify_password(password, password_hash))
        self.assertFalse(verify_password("wrong password", password_hash))

    def test_hashing_same_password_uses_different_salts(self) -> None:
        password = "correct horse battery staple"

        first_hash = hash_password(password)
        second_hash = hash_password(password)

        self.assertNotEqual(first_hash, second_hash)
        self.assertTrue(verify_password(password, first_hash))
        self.assertTrue(verify_password(password, second_hash))

    def test_empty_password_is_rejected_when_hashing(self) -> None:
        with self.assertRaises(ValueError):
            hash_password("")

    def test_invalid_passwords_fail_verification(self) -> None:
        password_hash = hash_password("valid password")

        self.assertFalse(verify_password("", password_hash))
        self.assertFalse(verify_password("valid password", "not a bcrypt hash"))
        self.assertFalse(verify_password("x" * 73, password_hash))

    def test_invalid_hash_does_not_raise(self) -> None:
        self.assertFalse(verify_password("valid password", "$2b$invalid"))

    def test_passwords_over_bcrypt_limit_are_rejected_when_hashing(self) -> None:
        with self.assertRaises(ValueError):
            hash_password("x" * 73)


class AccessTokenSecurityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = get_settings()

    def test_access_token_contains_subject_and_valid_claims(self) -> None:
        user_id = UUID("12345678-1234-5678-1234-567812345678")
        token = create_access_token(user_id)

        payload = decode_access_token(token)

        self.assertEqual(payload["sub"], str(user_id))
        self.assertIn("exp", payload)
        self.assertIn("iat", payload)
        self.assertEqual(payload["token_type"], "access")

    def test_expired_token_is_rejected(self) -> None:
        token = create_access_token("user-id-123", timedelta(seconds=-1))

        with self.assertRaises(ValueError):
            decode_access_token(token)

    def test_invalid_signature_is_rejected(self) -> None:
        token = create_access_token("user-id-123")
        payload = jwt.decode(
            token,
            self.settings.jwt_secret_key,
            algorithms=[self.settings.jwt_algorithm],
        )
        invalid_token = jwt.encode(
            payload,
            "a-different-secret-key-that-is-long-enough",
            algorithm=self.settings.jwt_algorithm,
        )

        with self.assertRaises(ValueError):
            decode_access_token(invalid_token)

    def test_invalid_token_format_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            decode_access_token("not-a-jwt")

    def test_missing_expiration_is_rejected(self) -> None:
        token = jwt.encode(
            {
                "sub": "user-id-123",
                "iat": 1_900_000_000,
                "token_type": "access",
            },
            self.settings.jwt_secret_key,
            algorithm=self.settings.jwt_algorithm,
        )

        with self.assertRaises(ValueError):
            decode_access_token(token)

    def test_missing_subject_is_rejected(self) -> None:
        token = jwt.encode(
            {
                "iat": 1_900_000_000,
                "exp": 1_900_000_600,
                "token_type": "access",
            },
            self.settings.jwt_secret_key,
            algorithm=self.settings.jwt_algorithm,
        )

        with self.assertRaises(ValueError):
            decode_access_token(token)

    def test_invalid_token_type_is_rejected(self) -> None:
        token = jwt.encode(
            {
                "sub": "user-id-123",
                "iat": 1_900_000_000,
                "exp": 1_900_000_600,
                "token_type": "refresh",
            },
            self.settings.jwt_secret_key,
            algorithm=self.settings.jwt_algorithm,
        )

        with self.assertRaises(ValueError):
            decode_access_token(token)


if __name__ == "__main__":
    unittest.main()
