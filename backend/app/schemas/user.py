from pydantic import BaseModel, Field

from app.schemas.auth import UserProfileResponse


class UserProfileUpdateRequest(BaseModel):
    nickname: str | None = Field(default=None, min_length=2, max_length=100)
    preferred_themes: list[str] | None = None
    preferred_transport: str | None = Field(default=None, max_length=50)


class UserProfileEnvelope(BaseModel):
    user: UserProfileResponse