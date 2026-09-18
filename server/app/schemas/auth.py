import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class UserRegistration(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized_name = value.strip()
        if not normalized_name:
            raise ValueError("name must not be empty")
        return normalized_name

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("email must be a string")
        return value.strip().lower()

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if not _EMAIL_PATTERN.fullmatch(value):
            raise ValueError("invalid email address")
        return value

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("password must be at most 72 UTF-8 bytes")
        return value


class UserLogin(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("email must be a string")
        return value.strip().lower()

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if not _EMAIL_PATTERN.fullmatch(value):
            raise ValueError("invalid email address")
        return value

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("password must be at most 72 UTF-8 bytes")
        return value


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str = Field(min_length=1)
    token_type: str = Field(min_length=1)
