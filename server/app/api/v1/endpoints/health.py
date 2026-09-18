from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.session import engine
from app.api.deps import get_db

router = APIRouter(
    prefix="/health",
    tags=["Health"],
)


@router.get("")
def health_check():
    return {
        "status": "healthy",
    }


@router.get("/database")
def database_health_check(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT 1"))
    database_result = result.scalar()

    return {
        "database": "connected",
        "result": database_result,
    }


@router.get("/postgis")
def postgis_health_check():
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT PostGIS_Version()")
        )
        postgis_version = result.scalar()

    return {
        "postgis": "available",
        "version": postgis_version,
    }