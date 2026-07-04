from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
from app.api.routes.external import (
    kakao_router,
    router as external_router,
    weather_router,
)
from app.api.routes.users import router as users_router

__all__ = [
    "health_router",
    "auth_router",
    "external_router",
    "kakao_router",
    "weather_router",
    "users_router",
]