from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings


def configure_cors(app):
    settings = get_settings()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )