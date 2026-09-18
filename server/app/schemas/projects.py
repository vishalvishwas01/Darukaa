from datetime import datetime
from uuid import UUID
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


ProjectStatus = Literal["active", "archived", "draft"]


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10_000)
    project_type: str = Field(min_length=1, max_length=50)


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10_000)
    project_type: str | None = Field(default=None, min_length=1, max_length=50)
    status: ProjectStatus | None = None

    @model_validator(mode="after")
    def reject_empty_update(self) -> "ProjectUpdate":
        if not self.model_fields_set:
            raise ValueError("at least one project field is required")
        for field_name in ("name", "project_type", "status"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_id: UUID
    name: str
    description: str | None
    project_type: str
    status: str
    created_at: datetime
    updated_at: datetime
