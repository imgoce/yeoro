# 여로(Yeoro) 배포 가이드 — Google Cloud Run

이 문서 하나만 따라 하면 배포가 됩니다. 명령어는 복사해서 붙여넣으면 됩니다.

> **이 배포의 특징**
> 백엔드(API)와 웹 화면을 **주소 하나로 함께** 제공합니다.
> → CORS 설정 불필요, 카카오 콘솔에도 도메인 하나만 등록하면 됩니다.

---

## 0. 미리 준비할 것

| 준비물 | 설명 |
|---|---|
| Google 계정 + 카드 등록 | 무료 범위(월 200만 요청) 안이면 청구되지 않습니다 |
| `gcloud` CLI | https://cloud.google.com/sdk/docs/install 에서 설치 |
| PostgreSQL 주소 | 아래 1단계 참고 (무료로 만들 수 있습니다) |

---

## 1. 데이터베이스 준비 (필수)

> ⚠️ **Cloud Run은 서버가 꺼지면 파일이 사라집니다.** SQLite를 그대로 쓰면 회원 정보와
> 여행로그가 전부 날아갑니다. 반드시 외부 PostgreSQL을 연결하세요.

무료로 쓸 수 있는 곳:

| 서비스 | 무료 제공 |
|---|---|
| **Neon** (neon.tech) | PostgreSQL 무료, 가입 즉시 주소 발급 |
| **Supabase** (supabase.com) | PostgreSQL 500MB 무료 |

가입하면 아래 같은 접속 주소를 줍니다. 이걸 복사해 두세요.

```
postgres://사용자:비밀번호@호스트/디비이름
```

> 접두어가 `postgres://` 든 `postgresql://` 든 상관없습니다. 코드가 알아서 변환합니다.

---

## 2. 배포하기

프로젝트 폴더(`yeoro/`)에서 아래 명령어를 실행합니다.

```bash
gcloud run deploy yeoro \
  --source . \
  --region asia-northeast3 \
  --allow-unauthenticated
```

- `asia-northeast3` = 서울 리전 (한국 사용자에게 가장 빠름)
- `--allow-unauthenticated` = 누구나 접속 가능 (앱 서비스이므로 필요)

처음 실행하면 API 활성화 여부를 물어보는데 모두 `y`로 답하면 됩니다.
완료되면 이런 주소를 알려줍니다:

```
https://yeoro-xxxxxxxx.a.run.app
```

---

## 3. 환경변수(키) 등록

배포된 서비스에 키를 넣습니다. **키는 코드가 아니라 여기에만 저장됩니다.**

```bash
gcloud run services update yeoro \
  --region asia-northeast3 \
  --set-env-vars \
DATABASE_URL="postgres://...1단계에서 복사한 주소...",\
SECRET_KEY="아무도_모르는_긴_문자열_32자_이상",\
PUBLIC_DATA_GO_KR_KEY="공공데이터포털 키",\
PUBLIC_KAKAO_REST_KEY="카카오 REST 키",\
KAKAO_MAP_REST_API_KEY="카카오 REST 키",\
KAKAO_KA_ORIGIN="https://yeoro-xxxxxxxx.a.run.app"
```

### 환경변수 설명

| 변수 | 필수 | 설명 |
|---|:---:|---|
| `DATABASE_URL` | ✅ | 1단계의 PostgreSQL 주소 |
| `SECRET_KEY` | ✅ | 로그인 토큰 서명용. 아무거나 길게(32자 이상) |
| `PUBLIC_DATA_GO_KR_KEY` | ✅ | 공공데이터포털 키 (관광·날씨·의료 공용) |
| `PUBLIC_KAKAO_REST_KEY` | ✅ | 카카오 REST 키 (지도 검색) |
| `KAKAO_MAP_REST_API_KEY` | ✅ | 위와 같은 값 (백엔드 프록시용) |
| `KAKAO_KA_ORIGIN` | ✅ | **2단계에서 받은 배포 주소** |
| `PUBLIC_KAKAO_JS_KEY` | | 별도 JS 키가 있다면. 없으면 REST 키를 씁니다 |
| `CORS_EXTRA_ORIGINS` | | 다른 도메인을 추가로 쓸 때만 |

---

## 4. 카카오 콘솔 설정

[developers.kakao.com](https://developers.kakao.com) → 내 애플리케이션 → **여로**

| 메뉴 | 등록할 값 |
|---|---|
| 앱 설정 → 플랫폼 → **Web** | `https://yeoro-xxxxxxxx.a.run.app` |
| 카카오 로그인 → **Redirect URI** | `https://yeoro-xxxxxxxx.a.run.app/` |

> 기존 `http://localhost:5500` 은 **지우지 말고 그대로 두세요.** 개발할 때 계속 씁니다.

---

## 5. 확인

```bash
# 서버 살아있는지
curl https://yeoro-xxxxxxxx.a.run.app/health

# 웹 화면 열기 — 브라우저에 주소 입력
https://yeoro-xxxxxxxx.a.run.app
```

체크리스트:

- [ ] 화면이 뜨는가
- [ ] 게스트 로그인이 되는가 (백엔드 연결 확인)
- [ ] 관광명소 목록이 실제 데이터로 나오는가 (키 주입 확인)
- [ ] 홈 배너에 날씨가 뜨는가

---

## 6. 안드로이드 앱에 배포 주소 반영

앱은 화면을 APK 안에서 읽기 때문에 **서버 주소를 한 번 적어줘야** 합니다.

`frontend/js/config.js` 상단:

```js
const DEPLOY_API_BASE_URL = 'https://yeoro-xxxxxxxx.a.run.app';
```

수정 후 APK를 다시 빌드하면 앱이 배포 서버를 사용합니다.

---

## 자주 겪는 문제

| 증상 | 원인·해결 |
|---|---|
| 화면은 뜨는데 목록이 예시 데이터만 나옴 | `PUBLIC_DATA_GO_KR_KEY` 미등록 → 3단계 확인 |
| 로그인 시 오류 | `DATABASE_URL` 또는 `SECRET_KEY` 미등록 |
| 지도 검색이 안 됨 | `KAKAO_KA_ORIGIN`이 배포 주소와 다르거나, 카카오 콘솔에 도메인 미등록 |
| 카카오 로그인 `KOE006` | 카카오 콘솔에 Redirect URI 미등록 → 4단계 |
| 첫 접속이 1~3초 느림 | 정상입니다. 접속이 없으면 서버가 절전하고, 요청이 오면 깨어납니다 |

---

## 로컬 개발은 그대로입니다

배포 설정을 넣어도 로컬 개발 방식은 바뀌지 않습니다.

```bash
cd frontend
python tools/live_server.py 5500      # 미리보기(5500) + 백엔드(8000) 자동 실행
```

`PUBLIC_*` 환경변수가 없으면 서버는 기존 `frontend/js/config.local.js` 파일을 그대로 사용합니다.
