from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import distinct, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.project import Project
from app.models.site import Site
from app.models.site_metric import SiteMetric
from app.models.user import User
from app.schemas.metrics import (
    MetricSummary,
    ProjectAnalyticsSummary,
    SiteAnalyticsSummary,
    SiteMetricCreate,
    SiteMetricPage,
    SiteMetricResponse,
    SiteMetricUpdate,
    SiteRecordCount,
    SiteTimeseriesResponse,
    TimeseriesPoint,
)


router = APIRouter(
    prefix="/projects",
    tags=["Metrics and Analytics"],
)
_MAX_LIMIT = 1000


def _not_found(resource: str = "Resource") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"{resource} not found.",
    )


def _database_failure(db: Session, detail: str) -> HTTPException:
    db.rollback()
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=detail,
    )


def _validate_date_range(
    start_date: datetime | None,
    end_date: datetime | None,
) -> None:
    if start_date is not None and end_date is not None and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="start_date must not be after end_date.",
        )


def _owned_project_query(project_id: UUID, user_id: UUID):
    return select(Project).where(
        Project.id == project_id,
        Project.owner_id == user_id,
    )


def _owned_site_query(project_id: UUID, site_id: UUID, user_id: UUID):
    return (
        select(Site)
        .join(Project, Project.id == Site.project_id)
        .where(
            Site.id == site_id,
            Site.project_id == project_id,
            Project.owner_id == user_id,
        )
    )


def _metric_filters(
    query,
    site_id: UUID,
    metric_name: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
):
    query = query.where(SiteMetric.site_id == site_id)
    if metric_name is not None:
        query = query.where(SiteMetric.metric_name == metric_name.strip())
    if start_date is not None:
        query = query.where(SiteMetric.recorded_at >= start_date)
    if end_date is not None:
        query = query.where(SiteMetric.recorded_at <= end_date)
    return query


def _latest_rows_query(site_ids: list[UUID] | None = None, site_id: UUID | None = None):
    filters = []
    if site_id is not None:
        filters.append(SiteMetric.site_id == site_id)
    elif site_ids is not None:
        filters.append(SiteMetric.site_id.in_(site_ids) if site_ids else False)

    ranked = select(
        SiteMetric.metric_name.label("metric_name"),
        SiteMetric.unit.label("unit"),
        SiteMetric.metric_value.label("latest_value"),
        SiteMetric.recorded_at.label("latest_recorded_at"),
        func.row_number()
        .over(
            partition_by=SiteMetric.metric_name,
            order_by=[SiteMetric.recorded_at.desc(), SiteMetric.id.desc()],
        )
        .label("row_number"),
    ).where(*filters).subquery()
    return select(
        ranked.c.metric_name,
        ranked.c.unit,
        ranked.c.latest_value,
        ranked.c.latest_recorded_at,
    ).where(ranked.c.row_number == 1).order_by(ranked.c.metric_name)


def _metric_summary_rows_query(site_ids: list[UUID] | None = None, site_id: UUID | None = None):
    filters = []
    if site_id is not None:
        filters.append(SiteMetric.site_id == site_id)
    elif site_ids is not None:
        filters.append(SiteMetric.site_id.in_(site_ids) if site_ids else False)
    return (
        select(
            SiteMetric.metric_name,
            SiteMetric.unit,
            func.count(SiteMetric.id).label("record_count"),
            func.min(SiteMetric.metric_value).label("minimum_value"),
            func.max(SiteMetric.metric_value).label("maximum_value"),
            func.avg(SiteMetric.metric_value).label("average_value"),
        )
        .where(*filters)
        .group_by(SiteMetric.metric_name, SiteMetric.unit)
        .order_by(SiteMetric.metric_name, SiteMetric.unit)
    )


def _build_metric_summaries(summary_rows, latest_rows) -> list[MetricSummary]:
    latest_by_name = {row.metric_name: row for row in latest_rows}
    summaries = []
    for row in summary_rows:
        latest = latest_by_name.get(row.metric_name)
        if latest is None:
            continue
        summaries.append(
            MetricSummary(
                metric_name=row.metric_name,
                unit=row.unit,
                record_count=int(row.record_count),
                minimum_value=Decimal(str(row.minimum_value)),
                maximum_value=Decimal(str(row.maximum_value)),
                average_value=Decimal(str(row.average_value)),
                latest_value=Decimal(str(latest.latest_value)),
                latest_recorded_at=latest.latest_recorded_at,
            )
        )
    return summaries


def _load_site_summary(db: Session, site_id: UUID) -> SiteAnalyticsSummary:
    total = db.scalar(
        select(func.count(SiteMetric.id)).where(SiteMetric.site_id == site_id)
    ) or 0
    names = list(
        db.scalars(
            select(distinct(SiteMetric.metric_name))
            .where(SiteMetric.site_id == site_id)
            .order_by(SiteMetric.metric_name)
        ).all()
    )
    earliest, latest = db.execute(
        select(
            func.min(SiteMetric.recorded_at),
            func.max(SiteMetric.recorded_at),
        ).where(SiteMetric.site_id == site_id)
    ).one()
    summary_rows = db.execute(
        _metric_summary_rows_query(site_id=site_id)
    ).all()
    latest_rows = db.execute(_latest_rows_query(site_id=site_id)).all()
    return SiteAnalyticsSummary(
        site_id=site_id,
        total_metric_records=int(total),
        available_metric_names=names,
        earliest_recorded_at=earliest,
        latest_recorded_at=latest,
        metrics=_build_metric_summaries(summary_rows, latest_rows),
    )


def _load_project_summary(db: Session, project_id: UUID) -> ProjectAnalyticsSummary:
    site_ids = list(
        db.scalars(
            select(Site.id)
            .where(Site.project_id == project_id)
            .order_by(Site.id)
        ).all()
    )
    total_metric_records = db.scalar(
        select(func.count(SiteMetric.id)).where(
            SiteMetric.site_id.in_(site_ids) if site_ids else False
        )
    ) or 0
    names = list(
        db.scalars(
            select(distinct(SiteMetric.metric_name))
            .where(
                SiteMetric.site_id.in_(site_ids) if site_ids else False
            )
            .order_by(SiteMetric.metric_name)
        ).all()
    )
    summary_rows = db.execute(
        _metric_summary_rows_query(site_ids=site_ids)
    ).all()
    latest_rows = db.execute(_latest_rows_query(site_ids=site_ids)).all()
    count_rows = db.execute(
        select(Site.id, func.count(SiteMetric.id).label("record_count"))
        .outerjoin(SiteMetric, SiteMetric.site_id == Site.id)
        .where(Site.project_id == project_id)
        .group_by(Site.id)
        .order_by(Site.id)
    ).all()
    return ProjectAnalyticsSummary(
        project_id=project_id,
        total_sites=len(site_ids),
        total_metric_records=int(total_metric_records),
        available_metric_names=names,
        metrics=_build_metric_summaries(summary_rows, latest_rows),
        site_record_counts=[
            SiteRecordCount(site_id=row[0], record_count=int(row[1]))
            for row in count_rows
        ],
    )


@router.post(
    "/{project_id}/sites/{site_id}/metrics",
    response_model=SiteMetricResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_metric(
    project_id: UUID,
    site_id: UUID,
    metric_data: SiteMetricCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SiteMetric:
    try:
        site = db.scalar(_owned_site_query(project_id, site_id, current_user.id))
        if site is None:
            raise _not_found("Site")
        metric = SiteMetric(
            site_id=site.id,
            metric_name=metric_data.metric_name,
            metric_value=metric_data.metric_value,
            unit=metric_data.unit,
            recorded_at=metric_data.recorded_at,
        )
        db.add(metric)
        db.commit()
        db.refresh(metric)
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        raise _database_failure(db, "Unable to create metric.") from exc
    return metric


@router.get(
    "/{project_id}/sites/{site_id}/metrics",
    response_model=SiteMetricPage,
)
def list_metrics(
    project_id: UUID,
    site_id: UUID,
    metric_name: str | None = Query(default=None, min_length=1, max_length=100),
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    limit: int = Query(default=100, ge=1, le=_MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SiteMetricPage:
    _validate_date_range(start_date, end_date)
    if metric_name is not None and not metric_name.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="metric_name must not be empty.",
        )
    try:
        site = db.scalar(_owned_site_query(project_id, site_id, current_user.id))
        if site is None:
            raise _not_found("Site")
        filtered = _metric_filters(
            select(SiteMetric), site_id, metric_name, start_date, end_date
        )
        total = db.scalar(
            select(func.count()).select_from(filtered.subquery())
        ) or 0
        items = list(
            db.scalars(
                filtered.order_by(
                    SiteMetric.recorded_at.asc(),
                    SiteMetric.id.asc(),
                ).limit(limit).offset(offset)
            ).all()
        )
        return SiteMetricPage(
            items=items,
            total=int(total),
            limit=limit,
            offset=offset,
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise _database_failure(db, "Unable to list metrics.") from exc


@router.get(
    "/{project_id}/sites/{site_id}/metrics/{metric_id}",
    response_model=SiteMetricResponse,
)
def get_metric(
    project_id: UUID,
    site_id: UUID,
    metric_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SiteMetric:
    try:
        metric = db.scalar(
            select(SiteMetric)
            .join(Site, Site.id == SiteMetric.site_id)
            .join(Project, Project.id == Site.project_id)
            .where(
                SiteMetric.id == metric_id,
                SiteMetric.site_id == site_id,
                Site.project_id == project_id,
                Project.owner_id == current_user.id,
            )
        )
    except SQLAlchemyError as exc:
        raise _database_failure(db, "Unable to retrieve metric.") from exc
    if metric is None:
        raise _not_found("Metric")
    return metric


@router.patch(
    "/{project_id}/sites/{site_id}/metrics/{metric_id}",
    response_model=SiteMetricResponse,
)
def update_metric(
    project_id: UUID,
    site_id: UUID,
    metric_id: UUID,
    metric_data: SiteMetricUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SiteMetric:
    try:
        metric = db.scalar(
            select(SiteMetric)
            .join(Site, Site.id == SiteMetric.site_id)
            .join(Project, Project.id == Site.project_id)
            .where(
                SiteMetric.id == metric_id,
                SiteMetric.site_id == site_id,
                Site.project_id == project_id,
                Project.owner_id == current_user.id,
            )
        )
        if metric is None:
            raise _not_found("Metric")
        for field_name, value in metric_data.model_dump(exclude_unset=True).items():
            setattr(metric, field_name, value)
        db.commit()
        db.refresh(metric)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise _database_failure(db, "Unable to update metric.") from exc
    return metric


@router.delete(
    "/{project_id}/sites/{site_id}/metrics/{metric_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_metric(
    project_id: UUID,
    site_id: UUID,
    metric_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    try:
        metric = db.scalar(
            select(SiteMetric)
            .join(Site, Site.id == SiteMetric.site_id)
            .join(Project, Project.id == Site.project_id)
            .where(
                SiteMetric.id == metric_id,
                SiteMetric.site_id == site_id,
                Site.project_id == project_id,
                Project.owner_id == current_user.id,
            )
        )
        if metric is None:
            raise _not_found("Metric")
        db.delete(metric)
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise _database_failure(db, "Unable to delete metric.") from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{project_id}/sites/{site_id}/analytics/summary",
    response_model=SiteAnalyticsSummary,
)
def site_analytics_summary(
    project_id: UUID,
    site_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SiteAnalyticsSummary:
    try:
        if db.scalar(_owned_site_query(project_id, site_id, current_user.id)) is None:
            raise _not_found("Site")
        return _load_site_summary(db, site_id)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise _database_failure(db, "Unable to calculate site analytics.") from exc


@router.get(
    "/{project_id}/sites/{site_id}/analytics/timeseries",
    response_model=SiteTimeseriesResponse,
)
def site_analytics_timeseries(
    project_id: UUID,
    site_id: UUID,
    metric_name: str = Query(..., min_length=1, max_length=100),
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    limit: int = Query(default=1000, ge=1, le=_MAX_LIMIT),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SiteTimeseriesResponse:
    _validate_date_range(start_date, end_date)
    metric_name = metric_name.strip()
    if not metric_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="metric_name must not be empty.",
        )
    try:
        if db.scalar(_owned_site_query(project_id, site_id, current_user.id)) is None:
            raise _not_found("Site")
        query = _metric_filters(
            select(SiteMetric), site_id, metric_name, start_date, end_date
        ).order_by(SiteMetric.recorded_at.asc(), SiteMetric.id.asc()).limit(limit)
        metrics = list(db.scalars(query).all())
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise _database_failure(db, "Unable to retrieve time-series data.") from exc
    return SiteTimeseriesResponse(
        site_id=site_id,
        metric_name=metric_name,
        unit=metrics[0].unit if metrics else None,
        points=[
            TimeseriesPoint(recorded_at=metric.recorded_at, value=metric.metric_value)
            for metric in metrics
        ],
    )


@router.get(
    "/{project_id}/analytics/summary",
    response_model=ProjectAnalyticsSummary,
)
def project_analytics_summary(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectAnalyticsSummary:
    try:
        if db.scalar(_owned_project_query(project_id, current_user.id)) is None:
            raise _not_found("Project")
        return _load_project_summary(db, project_id)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise _database_failure(db, "Unable to calculate project analytics.") from exc
