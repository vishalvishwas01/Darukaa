import json
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from geoalchemy2 import WKTElement
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.project import Project
from app.models.site import Site
from app.models.user import User
from app.schemas.projects import ProjectCreate, ProjectResponse, ProjectUpdate
from app.schemas.sites import GeoJSONPolygon, SiteCreate, SiteResponse, SiteUpdate


router = APIRouter(
    prefix="/projects",
    tags=["Projects"],
)


def _not_found(resource: str) -> HTTPException:
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


def _polygon_to_wkt(polygon: GeoJSONPolygon) -> str:
    rings = []
    for ring in polygon.coordinates:
        points = ", ".join(f"{longitude:.15g} {latitude:.15g}" for longitude, latitude in ring)
        rings.append(f"({points})")
    return f"POLYGON({', '.join(rings)})"


def _site_response(site: Site, boundary: dict) -> SiteResponse:
    return SiteResponse(
        id=site.id,
        project_id=site.project_id,
        name=site.name,
        description=site.description,
        boundary=GeoJSONPolygon.model_validate(boundary),
        area_hectares=site.area_hectares,
        created_at=site.created_at,
        updated_at=site.updated_at,
    )


def _decode_boundary(value: str | dict) -> dict:
    if isinstance(value, str):
        return json.loads(value)
    return value


def _site_query():
    return select(
        Site,
        func.ST_AsGeoJSON(Site.boundary).label("boundary_geojson"),
    )


def _site_from_row(row) -> SiteResponse:
    site, boundary = row
    return _site_response(site, _decode_boundary(boundary))


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Project:
    project = Project(
        owner_id=current_user.id,
        name=project_data.name,
        description=project_data.description,
        project_type=project_data.project_type,
    )

    try:
        db.add(project)
        db.commit()
        db.refresh(project)
    except SQLAlchemyError as exc:
        raise _database_failure(db, "Unable to create project.") from exc

    return project


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Project]:
    try:
        return list(
            db.scalars(
                select(Project)
                .where(Project.owner_id == current_user.id)
                .order_by(Project.created_at.desc(), Project.id.desc())
            ).all()
        )
    except SQLAlchemyError as exc:
        raise _database_failure(db, "Unable to list projects.") from exc


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Project:
    try:
        project = db.scalar(
            select(Project).where(
                Project.id == project_id,
                Project.owner_id == current_user.id,
            )
        )
    except SQLAlchemyError as exc:
        raise _database_failure(db, "Unable to retrieve project.") from exc

    if project is None:
        raise _not_found("Project")
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Project:
    try:
        project = db.scalar(
            select(Project).where(
                Project.id == project_id,
                Project.owner_id == current_user.id,
            )
        )
        if project is None:
            raise _not_found("Project")

        for field_name, value in project_data.model_dump(exclude_unset=True).items():
            setattr(project, field_name, value)

        db.commit()
        db.refresh(project)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise _database_failure(db, "Unable to update project.") from exc

    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    try:
        project = db.scalar(
            select(Project).where(
                Project.id == project_id,
                Project.owner_id == current_user.id,
            )
        )
        if project is None:
            raise _not_found("Project")

        db.delete(project)
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise _database_failure(db, "Unable to delete project.") from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{project_id}/sites",
    response_model=SiteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_site(
    project_id: UUID,
    site_data: SiteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SiteResponse:
    try:
        project = db.scalar(
            select(Project).where(
                Project.id == project_id,
                Project.owner_id == current_user.id,
            )
        )
        if project is None:
            raise _not_found("Project")

        wkt = _polygon_to_wkt(site_data.boundary)
        geometry_is_valid = db.scalar(
            select(func.ST_IsValid(func.ST_GeomFromText(wkt, 4326)))
        )
        if not geometry_is_valid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Boundary polygon is not geometrically valid.",
            )

        area_hectares = db.scalar(
            select(func.ST_Area(func.ST_GeogFromText(wkt)) / 10_000)
        )
        if area_hectares is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Unable to calculate boundary area.",
            )

        site = Site(
            project_id=project.id,
            name=site_data.name,
            description=site_data.description,
            boundary=WKTElement(wkt, srid=4326),
            area_hectares=Decimal(str(area_hectares)),
        )
        db.add(site)
        db.commit()
        db.refresh(site)
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        raise _database_failure(db, "Unable to create site.") from exc

    return _site_response(site, site_data.boundary.model_dump())


@router.get("/{project_id}/sites", response_model=list[SiteResponse])
def list_sites(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SiteResponse]:
    try:
        project = db.scalar(
            select(Project).where(
                Project.id == project_id,
                Project.owner_id == current_user.id,
            )
        )
        if project is None:
            raise _not_found("Project")

        rows = db.execute(
            _site_query()
            .where(Site.project_id == project_id)
            .order_by(Site.created_at.desc(), Site.id.desc())
        ).all()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise _database_failure(db, "Unable to list sites.") from exc

    return [_site_from_row(row) for row in rows]


@router.get("/{project_id}/sites/{site_id}", response_model=SiteResponse)
def get_site(
    project_id: UUID,
    site_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SiteResponse:
    try:
        project = db.scalar(
            select(Project).where(
                Project.id == project_id,
                Project.owner_id == current_user.id,
            )
        )
        if project is None:
            raise _not_found("Site")

        row = db.execute(
            _site_query().where(
                Site.id == site_id,
                Site.project_id == project_id,
            )
        ).first()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise _database_failure(db, "Unable to retrieve site.") from exc

    if row is None:
        raise _not_found("Site")
    return _site_from_row(row)


@router.patch("/{project_id}/sites/{site_id}", response_model=SiteResponse)
def update_site(
    project_id: UUID,
    site_id: UUID,
    site_data: SiteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SiteResponse:
    try:
        project = db.scalar(
            select(Project).where(
                Project.id == project_id,
                Project.owner_id == current_user.id,
            )
        )
        if project is None:
            raise _not_found("Site")

        site = db.scalar(
            select(Site).where(
                Site.id == site_id,
                Site.project_id == project_id,
            )
        )
        if site is None:
            raise _not_found("Site")

        updates = site_data.model_dump(exclude_unset=True)
        boundary = site_data.boundary
        if boundary is not None:
            wkt = _polygon_to_wkt(boundary)
            geometry_is_valid = db.scalar(
                select(func.ST_IsValid(func.ST_GeomFromText(wkt, 4326)))
            )
            if not geometry_is_valid:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Boundary polygon is not geometrically valid.",
                )
            area_hectares = db.scalar(
                select(func.ST_Area(func.ST_GeogFromText(wkt)) / 10_000)
            )
            if area_hectares is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Unable to calculate boundary area.",
                )
            updates["boundary"] = WKTElement(wkt, srid=4326)
            updates["area_hectares"] = Decimal(str(area_hectares))

        for field_name, value in updates.items():
            setattr(site, field_name, value)

        db.commit()
        db.refresh(site)
        row = db.execute(
            _site_query().where(Site.id == site_id)
        ).first()
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        raise _database_failure(db, "Unable to update site.") from exc

    if row is None:
        raise _not_found("Site")
    return _site_from_row(row)


@router.delete(
    "/{project_id}/sites/{site_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_site(
    project_id: UUID,
    site_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    try:
        project = db.scalar(
            select(Project).where(
                Project.id == project_id,
                Project.owner_id == current_user.id,
            )
        )
        if project is None:
            raise _not_found("Site")

        site = db.scalar(
            select(Site).where(
                Site.id == site_id,
                Site.project_id == project_id,
            )
        )
        if site is None:
            raise _not_found("Site")

        db.delete(site)
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise _database_failure(db, "Unable to delete site.") from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)
