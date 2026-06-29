from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="세종시 맞춤형 여행 큐레이션 서비스 백엔드 API",
    )
    application.include_router(health_router)
    return application

app = create_application()

# CORS 설정: 앱 배포 시 승인된 도메인만 통신 허용
origins = [
    "http://localhost:3000",
    "https://your-production-app-domain.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": f"Welcome to {settings.PROJECT_NAME} API"}