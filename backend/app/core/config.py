from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Yeoro_Backend"
    SECRET_KEY: str = "YOUR_SUPER_SECRET_KEY_PLEASE_CHANGE_THIS"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # 오픈 API 연동 키 (5060 및 유아 동반 맞춤형 큐레이션용)
    TOUR_API_KEY: str = ""      # 웰니스, 무장애, 의료 관광정보 API 
    KAKAO_MAP_API_KEY: str = "" # 실시간 경로 최적화용
    WEATHER_API_KEY: str = ""   # 기상 대응 유동적 추천용

    class Config:
        env_file = ".env"

settings = Settings()