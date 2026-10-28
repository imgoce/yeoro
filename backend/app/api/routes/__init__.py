# app/api/routes/__init__.py

from app.api.routes.auth import router as auth_router
from app.api.routes.cart import router as cart_router
from app.api.routes.health import router as health_router
from app.api.routes.medical import router as medical_router
from app.api.routes.external import (
    tourism_router,
    kakao_router,
    weather_router,
    kakao_auth_router,
)
from app.api.routes.places import router as places_router
from app.api.routes.users import router as users_router
from app.api.routes.routes import router as routes_router
from app.api.routes.travel_log import router as travel_logs_router

# __all__ 도 외부에서 참조할 수 있도록 실제 라우터 목록으로 동기화해 줍니다.
__all__ = [
    "health_router",
    "auth_router",
    "cart_router",
    "external_router",
    "kakao_router",
    "medical_router",
    "places_router",
    "routes_router",
    "travel_logs_router",
    "weather_router",
    "kakao_auth_router",
    "users_router",
]
