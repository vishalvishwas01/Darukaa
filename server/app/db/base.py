from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import models so SQLAlchemy metadata includes every table.
from app.models import Project, Site, SiteMetric, User  # noqa: E402, F401