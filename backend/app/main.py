from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

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
async def root():
    return {"message": f"Welcome to {settings.PROJECT_NAME} API"}