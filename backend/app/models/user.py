from sqlalchemy import Column, Integer, String, Boolean, JSON
from sqlalchemy.ext.declarative import declarative_base

# 데이터베이스 베이스 클래스 (실제 환경에서는 별도의 database.py에서 관리하는 것을 권장합니다)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    
    # 여로 서비스 핵심 데이터: 사용자 타겟층 및 맞춤형 큐레이션용
    age_group = Column(String, nullable=False)  # 예: "5060", "유아동반"
    preferences = Column(JSON, default=list)    # 예: ["관광지", "먹거리", "축제"]
    
    is_active = Column(Boolean, default=True)