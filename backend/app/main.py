import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from app.api.routes.auth import router as auth_router
from app.api.routes.cart import router as cart_router
from app.api.routes.external import (
    tourism_router,
    kakao_router,
    weather_router,
    kakao_auth_router,
)
from app.api.routes.health import router as health_router
from app.api.routes.medical import router as medical_router
from app.api.routes.places import router as places_router
from app.api.routes.travel_log import router as travel_log_router
from app.api.routes.routes import router as routes_router
from app.api.routes.users import router as users_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.medical_facility import MedicalFacility

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(bind=engine)
    yield


def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="세종시 맞춤형 여행 큐레이션 서비스 백엔드 API",
        lifespan=lifespan,
    )

    # CORS 설정: 앱 배포 시 승인된 도메인만 통신 허용
    # 실제 배포 도메인은 하드코딩하지 않고 .env의 CORS_EXTRA_ORIGINS로 넣는다
    # (예: CORS_EXTRA_ORIGINS=https://yeoro.app,https://www.yeoro.app)
    origins = [
        "http://localhost:3000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "capacitor://localhost",       # Capacitor 기반 WebView 셸
        "null",                        # file:// 로 로드되는 안드로이드 WebView(현재 MainActivity 방식)의 Origin
        *[origin.strip() for origin in settings.cors_extra_origins.split(",") if origin.strip()],
    ]
    
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["*"],
    )
    
    application.include_router(auth_router)
    application.include_router(health_router)
    
    # ====================================================================
    # [수정] 4개의 외부 API 라우터를 메인 앱에 독립적으로 직접 등록합니다.
    # 각 라우터에 prefix("/external")를 수동으로 붙여 경로 계층을 만듭니다.
    # ====================================================================
    application.include_router(tourism_router, prefix="/external")
    application.include_router(kakao_router, prefix="/external")
    application.include_router(weather_router, prefix="/external")
    application.include_router(kakao_auth_router, prefix="/external")
    
    application.include_router(users_router)
    application.include_router(places_router)
    application.include_router(cart_router)
    application.include_router(routes_router)
    application.include_router(travel_log_router)
    application.include_router(medical_router)

    # 정적 파일 mount('/')보다 반드시 먼저 등록해야 이 경로가 가려지지 않는다
    _register_frontend_config_route(application)
    _mount_frontend(application)

    return application


def _register_frontend_config_route(application: FastAPI) -> None:
    """프론트엔드가 쓰는 공개 키를 서버 환경변수에서 만들어 내려준다.

    이렇게 하면 키를 깃 저장소나 배포 이미지에 넣지 않고 배포 환경(Cloud Run 환경변수)
    한 곳에서만 관리할 수 있다. 로컬 개발에서는 frontend/js/config.local.js 파일이
    그대로 쓰이고, 배포 환경에서는 이 응답이 그 자리를 대신한다.
    """
    if not settings.serve_frontend:
        return
    # PUBLIC_* 환경변수가 하나도 없으면(=로컬 개발) 이 경로를 만들지 않는다.
    # 그래야 개발자가 쓰던 frontend/js/config.local.js 파일이 그대로 사용된다.
    if not any(
        (
            settings.public_data_go_kr_key,
            settings.public_kakao_rest_key,
            settings.public_kakao_js_key,
            settings.public_kakao_navi_key,
        )
    ):
        return

    kakao_rest = settings.public_kakao_rest_key or settings.kakao_map_rest_api_key

    @application.get("/js/config.local.js", include_in_schema=False)
    def frontend_runtime_config() -> Response:
        values = {
            "DATA_GO_KR_KEY": settings.public_data_go_kr_key,
            "MEDICAL_API_KEY": settings.public_data_go_kr_key,
            "KAKAO_REST_KEY": kakao_rest,
            "KAKAO_JS_KEY": settings.public_kakao_js_key or kakao_rest,
            "KAKAO_NAVI_KEY": settings.public_kakao_navi_key,
        }
        assigns = "\n".join(
            f"    API_CONFIG.{name} = {json.dumps(value)};"
            for name, value in values.items()
            if value
        )
        body = (
            "/* 배포 환경: 서버가 환경변수로부터 만들어 내려주는 설정 */\n"
            "if (typeof API_CONFIG !== 'undefined') {\n"
            f"{assigns}\n"
            "}\n"
        )
        # 키가 바뀌면 바로 반영되도록 캐시하지 않는다
        return Response(
            content=body,
            media_type="application/javascript",
            headers={"Cache-Control": "no-store"},
        )


def _find_frontend_dir() -> Path | None:
    """프론트엔드 정적 파일 위치를 찾는다.
    - 배포(Docker): 이미지 안의 /app/frontend 로 복사해 둔다
    - 로컬 개발: 저장소의 ../frontend
    """
    candidates = [
        Path(__file__).resolve().parents[2] / "frontend",   # backend/app/main.py → backend/ → 저장소 루트
        Path("/app/frontend"),
    ]
    for path in candidates:
        if (path / "index.html").is_file():
            return path
    return None


def _mount_frontend(application: FastAPI) -> None:
    """웹 화면(HTML/CSS/JS)을 API와 같은 주소에서 함께 제공한다.
    주소가 하나로 합쳐지므로 프론트엔드 입장에서는 '같은 출처'가 되어
    CORS 설정도, 카카오 콘솔에 도메인을 두 개 등록할 필요도 없어진다.

    라우터 등록이 모두 끝난 뒤 마지막에 붙여야 '/'가 API 경로를 가리지 않는다.
    프론트 파일이 없으면(API 전용 배포) 조용히 건너뛴다.
    """
    if not settings.serve_frontend:
        return
    frontend_dir = _find_frontend_dir()
    if frontend_dir is None:
        return
    application.mount(
        "/",
        StaticFiles(directory=str(frontend_dir), html=True),
        name="frontend",
    )


app = create_application()
