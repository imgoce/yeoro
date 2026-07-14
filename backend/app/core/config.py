from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Sejong Tour API"
    app_env: str = "local"
    database_url: str = "sqlite:///./sejong_tour.db"
    secret_key: str = "change-this-secret-key"
    access_token_expire_minutes: int = 60 * 24
    jwt_algorithm: str = "HS256"
    tourism_api_base_url: str = "https://apis.data.go.kr/B551011/KorService1"
    tourism_api_key: str = ""
    tourism_api_timeout_seconds: float = 10.0
    kakao_map_api_base_url: str = "https://dapi.kakao.com"
    kakao_map_rest_api_key: str = ""
    kakao_map_timeout_seconds: float = 10.0
    kakao_client_secret: str = ""  # 카카오 앱에서 Client Secret을 활성화한 경우에만 필요
    weather_api_base_url: str = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0"
    weather_api_key: str = ""
    weather_api_timeout_seconds: float = 10.0
    redis_url: str = "redis://localhost:6379/0"
    redis_default_ttl_seconds: int = 300
    cors_extra_origins: str = ""  # 실제 배포 도메인. 쉼표로 여러 개 지정 가능 (예: "https://yeoro.app,https://www.yeoro.app")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()
