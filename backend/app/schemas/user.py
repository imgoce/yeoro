from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

# 회원가입 시 클라이언트가 보내는 요청 데이터 유효성 검사
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="비밀번호는 최소 8자 이상이어야 합니다.")
    age_group: str = Field(description="5060 또는 유아동반 등 타겟 연령층")
    preferences: Optional[List[str]] = Field(default=[], description="선호하는 여행 테마")

# 클라이언트에게 응답할 때 비밀번호를 제외하고 보내는 데이터 스키마
class UserResponse(BaseModel):
    id: int
    email: EmailStr
    age_group: str
    preferences: List[str]

    class Config:
        # SQLAlchemy 모델을 Pydantic 모델로 자동 변환하기 위한 설정 (최신 Pydantic v2 방식)
        from_attributes = True