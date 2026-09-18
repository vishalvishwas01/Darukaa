from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _validate_metric_name(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("metric_name must not be empty")
    return value


def _validate_unit(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("unit must not be empty")
    return value


def _validate_finite_value(value: Decimal) -> Decimal:
    if not value.is_finite():
        raise ValueError("metric_value must be finite")
    return value


class SiteMetricCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metric_name: str = Field(min_length=1, max_length=100)
    metric_value: Decimal
    unit: str = Field(min_length=1, max_length=50)
    recorded_at: datetime

    _metric_name = field_validator("metric_name")(_validate_metric_name)
    _metric_value = field_validator("metric_value")(_validate_finite_value)
    _unit = field_validator("unit")(_validate_unit)


class SiteMetricUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metric_name: str | None = Field(default=None, min_length=1, max_length=100)
    metric_value: Decimal | None = None
    unit: str | None = Field(default=None, min_length=1, max_length=50)
    recorded_at: datetime | None = None

    _metric_name = field_validator("metric_name")(_validate_metric_name)
    _metric_value = field_validator("metric_value")(_validate_finite_value)
    _unit = field_validator("unit")(_validate_unit)

    @model_validator(mode="after")
    def reject_empty_update(self) -> "SiteMetricUpdate":
        if not self.model_fields_set:
            raise ValueError("at least one metric field is required")
        for field_name in ("metric_name", "metric_value", "unit", "recorded_at"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self


class SiteMetricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    site_id: UUID
    metric_name: str
    metric_value: Decimal
    unit: str
    recorded_at: datetime
    created_at: datetime


class SiteMetricPage(BaseModel):
    items: list[SiteMetricResponse]
    total: int
    limit: int
    offset: int


class MetricSummary(BaseModel):
    metric_name: str
    unit: str
    record_count: int
    minimum_value: Decimal
    maximum_value: Decimal
    average_value: Decimal
    latest_value: Decimal
    latest_recorded_at: datetime


class SiteAnalyticsSummary(BaseModel):
    site_id: UUID
    total_metric_records: int
    available_metric_names: list[str]
    earliest_recorded_at: datetime | None
    latest_recorded_at: datetime | None
    metrics: list[MetricSummary]


class TimeseriesPoint(BaseModel):
    recorded_at: datetime
    value: Decimal


class SiteTimeseriesResponse(BaseModel):
    site_id: UUID
    metric_name: str
    unit: str | None
    points: list[TimeseriesPoint]


class SiteRecordCount(BaseModel):
    site_id: UUID
    record_count: int


class ProjectAnalyticsSummary(BaseModel):
    project_id: UUID
    total_sites: int
    total_metric_records: int
    available_metric_names: list[str]
    metrics: list[MetricSummary]
    site_record_counts: list[SiteRecordCount]