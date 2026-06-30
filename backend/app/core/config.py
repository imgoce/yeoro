from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Sejong Tour API"
    app_env: str = "local"
    database_url: str = "sqlite:///./sejong_tour.db"
    tourism_api_base_url: str = "https://apis.data.go.kr/B551011/KorService1"
    tourism_api_key: str = ""
    tourism_api_timeout_seconds: float = 10.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()
