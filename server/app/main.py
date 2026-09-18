from fastapi import FastAPI
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.cors import configure_cors
from app.db.session import engine

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Geospatial data analytics platform",
)

configure_cors(app)

app.include_router(
    api_router,
    prefix="/api/v1",
)

@app.get("/")
def root():
    return {
        "message": "Welcome to Darukaa.Earth API",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
    }


@app.get("/health/database")
def database_health_check():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        database_result = result.scalar()

    return {
        "database": "connected",
        "result": database_result,
    }


@app.get("/health/postgis")
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