from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegisterRequest(BaseModel):
    email: EmailStr
    nickname: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=8, max_length=100)
    preferred_themes: list[str] = Field(default_factory=list)
    preferred_transport: str | None = Field(default=None, max_length=50)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)


class KakaoTokenLoginRequest(BaseModel):
    access_token: str = Field(min_length=1)


class KakaoCallbackLoginRequest(BaseModel):
    code: str = Field(min_length=1)
    redirect_uri: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    nickname: str
    preferred_themes: list[str]
    preferred_transport: str | None
    is_active: bool


class KakaoLogoutRequest(BaseModel):
    access_token: str