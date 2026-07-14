# app/api/routes/__init__.py

from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router
# [수정] 존재하지 않는 대표 router(external_router)를 제거하고,
# 실제 존재하는 4개의 서브 라우터를 깔끔하게 임포트합니다.
from app.api.routes.external import (
    tourism_router,
    kakao_router,
    weather_router,
    kakao_auth_router,
)
from app.api.routes.users import router as users_router
from app.api.routes.travel_log import router as travel_log_router


# __all__ 도 외부에서 참조할 수 있도록 실제 라우터 목록으로 동기화해 줍니다.
__all__ = [
    "health_router",
    "auth_router",
    "tourism_router",
    "kakao_router",
    "weather_router",
    "kakao_auth_router",
    "users_router",
    "travel_log_router",
]