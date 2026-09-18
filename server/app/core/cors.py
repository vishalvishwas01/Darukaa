from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings


def configure_cors(app: FastAPI) -> None:
    settings = get_settings()

    allowed_origins = [
        settings.frontend_url.rstrip("/"),
        "https://darukaa-five.vercel.app",
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(set(allowed_origins)),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )