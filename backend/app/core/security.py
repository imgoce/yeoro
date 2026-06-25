import bcrypt
from datetime import datetime, timedelta
from typing import Optional
import jwt
from core.config import settings

def get_password_hash(password: str) -> str:
    """회원가입 시 비밀번호 단방향 암호화 (bcrypt 직접 사용)"""
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed_password.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """사용자가 입력한 비밀번호와 DB의 암호화된 비밀번호 비교"""
    return bcrypt.checkpw(
        plain_password.encode('utf-8'), 
        hashed_password.encode('utf-8')
    )

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """로그인 성공 시 클라이언트에게 발급할 JWT 토큰 생성"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt