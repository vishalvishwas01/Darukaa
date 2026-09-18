import math
from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


Coordinate = list[float]


def _orientation(first: Coordinate, second: Coordinate, third: Coordinate) -> float:
    return ((second[0] - first[0]) * (third[1] - first[1])) - (
        (second[1] - first[1]) * (third[0] - first[0])
    )


def _on_segment(first: Coordinate, second: Coordinate, point: Coordinate) -> bool:
    return (
        min(first[0], second[0]) <= point[0] <= max(first[0], second[0])
        and min(first[1], second[1]) <= point[1] <= max(first[1], second[1])
    )


def _segments_intersect(
    first_start: Coordinate,
    first_end: Coordinate,
    second_start: Coordinate,
    second_end: Coordinate,
) -> bool:
    first_orientation = _orientation(first_start, first_end, second_start)
    second_orientation = _orientation(first_start, first_end, second_end)
    third_orientation = _orientation(second_start, second_end, first_start)
    fourth_orientation = _orientation(second_start, second_end, first_end)

    if (
        ((first_orientation > 0 and second_orientation < 0) or (first_orientation < 0 and second_orientation > 0))
        and ((third_orientation > 0 and fourth_orientation < 0) or (third_orientation < 0 and fourth_orientation > 0))
    ):
        return True

    epsilon = 1e-12
    return (
        abs(first_orientation) <= epsilon
        and _on_segment(first_start, first_end, second_start)
    ) or (
        abs(second_orientation) <= epsilon
        and _on_segment(first_start, first_end, second_end)
    ) or (
        abs(third_orientation) <= epsilon
        and _on_segment(second_start, second_end, first_start)
    ) or (
        abs(fourth_orientation) <= epsilon
        and _on_segment(second_start, second_end, first_end)
    )


def _validate_ring(ring: list[Coordinate]) -> None:
    if len(ring) < 4:
        raise ValueError("polygon rings require at least four coordinates")
    if ring[0] != ring[-1]:
        raise ValueError("polygon rings must be closed")
    if len({tuple(point) for point in ring[:-1]}) < 3:
        raise ValueError("polygon rings require at least three distinct points")

    segment_count = len(ring) - 1
    for first_index in range(segment_count):
        for second_index in range(first_index + 1, segment_count):
            if second_index == first_index + 1:
                continue
            if first_index == 0 and second_index == segment_count - 1:
                continue
            if _segments_intersect(
                ring[first_index],
                ring[first_index + 1],
                ring[second_index],
                ring[second_index + 1],
            ):
                raise ValueError("polygon rings must not self-intersect")


class GeoJSONPolygon(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["Polygon"]
    coordinates: list[list[Coordinate]] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_geometry(self) -> "GeoJSONPolygon":
        for ring in self.coordinates:
            for coordinate in ring:
                if len(coordinate) != 2 or not all(math.isfinite(value) for value in coordinate):
                    raise ValueError("coordinates must contain finite longitude and latitude pairs")
                longitude, latitude = coordinate
                if not -180 <= longitude <= 180:
                    raise ValueError("longitude must be between -180 and 180")
                if not -90 <= latitude <= 90:
                    raise ValueError("latitude must be between -90 and 90")
            _validate_ring(ring)
        return self


class SiteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10_000)
    boundary: GeoJSONPolygon


class SiteUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10_000)
    boundary: GeoJSONPolygon | None = None

    @model_validator(mode="after")
    def reject_empty_update(self) -> "SiteUpdate":
        if not self.model_fields_set:
            raise ValueError("at least one site field is required")
        for field_name in ("name", "boundary"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self


class SiteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    name: str
    description: str | None
    boundary: GeoJSONPolygon
    area_hectares: Decimal | None
    created_at: datetime
    updated_at: datetime
