from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import TokenResponse, UserLogin, UserRegistration, UserResponse


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

_AUTHENTICATION_ERROR = "Invalid email or password."


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    registration: UserRegistration,
    db: Session = Depends(get_db),
) -> User:
    existing_user = db.scalar(
        select(User).where(User.email == registration.email)
    )
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        name=registration.name,
        email=registration.email,
        password_hash=hash_password(registration.password),
        role="user",
        is_active=True,
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from exc
    except Exception:
        db.rollback()
        raise

    return user


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login_user(
    credentials: UserLogin,
    db: Session = Depends(get_db),
) -> TokenResponse:
    try:
        user = db.scalar(
            select(User).where(User.email == credentials.email)
        )
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to process login.",
        ) from exc

    if (
        user is None
        or not verify_password(credentials.password, user.password_hash)
        or not user.is_active
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_AUTHENTICATION_ERROR,
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(user.id)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
    )


@router.get(
    "/me",
    response_model=UserResponse,
)
def get_authenticated_user(
    current_user: User = Depends(get_current_user),
) -> User:
    return current_user