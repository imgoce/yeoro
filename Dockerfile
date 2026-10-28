# 여로(Yeoro) 배포용 이미지
# ─ 백엔드(FastAPI) + 웹 화면(프론트엔드)을 하나의 서버로 함께 제공한다.
#   주소가 하나로 합쳐지므로 CORS 설정이 필요 없고, 카카오 콘솔에도 도메인을 하나만 등록하면 된다.
# ─ Google Cloud Run / 클라우드타입 / Railway 등 컨테이너를 받는 곳이면 어디든 동일하게 동작한다.

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# 1) 의존성 먼저 설치 — 코드만 바뀌면 이 단계는 캐시되어 다음 배포가 빨라진다
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 2) 백엔드 코드
COPY backend/app ./app

# 3) 웹 화면 — API와 같은 서버에서 제공한다
#    (API 키가 든 config.local.js는 .dockerignore로 제외되며,
#     배포 환경에서는 서버가 환경변수로 만들어 내려준다)
COPY frontend ./frontend

# Cloud Run은 PORT 환경변수로 포트를 알려준다. 로컬 실행 시 기본값 8080.
ENV PORT=8080
EXPOSE 8080

# shell 형식으로 실행해야 $PORT가 실제 값으로 치환된다
CMD exec uvicorn app.main:app --host 0.0.0.0 --port $PORT
