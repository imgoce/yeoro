# yeoro Android (WebView 래퍼)

`frontend/`를 그대로 WebView로 감싸서 실행하는 최소 네이티브 셸입니다. 존재 이유는 단 하나,
**카카오 로그인을 안정적으로 동작시키는 것**입니다 — 카카오(및 구글 등)는 보안상 임베디드
WebView의 User-Agent를 감지해 로그인을 차단합니다(`KOE101`/`disallowed_useragent`). 그래서
로그인만큼은 네이티브 카카오 SDK에 위임하고, 나머지 화면은 전부 기존 웹 프론트엔드를 그대로 씁니다.

## 동작 방식

1. `MainActivity`가 `file:///android_asset/www/index.html`을 WebView로 로드한다.
   (`www/`는 커밋된 파일이 아니라 **빌드할 때마다 `frontend/`에서 자동 복사**되는 산출물이다 —
   `app/build.gradle.kts`의 `syncWebAssets` 태스크, `preBuild`에 연결되어 있음. `frontend/`를
   고치면 다음 빌드에 자동 반영되고, 두 사본이 따로 놀 일이 없다.)
2. `frontend/js/auth.js`의 `startKakaoOAuth()`는 `window.YeoroNative`가 있으면(=네이티브 앱 안)
   `window.YeoroNative.startKakaoLogin()`을 호출한다. 없으면(=순수 웹) 기존 OAuth 리다이렉트
   방식 그대로 동작한다 — 웹 버전은 이번 변경으로 전혀 깨지지 않는다.
3. `KakaoLoginBridge`(JS 인터페이스) → `MainActivity.startKakaoLogin()`이 카카오 SDK를 호출:
   - 카카오톡 앱이 있으면 `loginWithKakaoTalk()` — 앱 전환으로 로그인, WebView와 무관.
   - 없으면 `loginWithKakaoAccount()` — SDK가 **자동으로 시스템 브라우저(Custom Tabs)** 를 열어
     로그인시키고, `AndroidManifest.xml`에 등록된 `AuthCodeHandlerActivity`가 그 결과를 받는다.
4. 로그인 성공/실패 결과는 `MainActivity`가 `webView.evaluateJavascript(...)`로
   `window.onNativeKakaoLoginResult(success, message)`를 호출해 JS 쪽으로 돌려준다.
5. 안전망: WebView가 어떤 이유로든 `kauth.kakao.com` 등 OAuth 도메인으로 직접 이동하려 하면
   `MainActivity`의 `WebViewClient.shouldOverrideUrlLoading`이 그 요청을 가로채 Chrome Custom
   Tabs로 열어버린다 (WebView 안에서는 절대 로드하지 않음).

## 사전 준비

### 1. Kakao Developers에서 앱 등록

1. https://developers.kakao.com → 내 애플리케이션 → 애플리케이션 추가
2. **앱 키 > 네이티브 앱 키** 복사 → `android/local.properties`에 `KAKAO_NATIVE_APP_KEY`로 입력
   (`android/local.properties.example`을 복사해서 만들 것 — `local.properties`는 git에 커밋되지 않음)
3. **플랫폼 > Android 플랫폼 등록**
   - 패키지명: `com.yeoro.app`
   - 키 해시: 아래 명령으로 디버그 키스토어 해시를 뽑아 등록

   ```bash
   # Windows(Git Bash)/macOS/Linux 공통, 디버그 키스토어 비밀번호는 기본값 "android"
   keytool -exportcert -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android | openssl sha1 -binary | openssl base64
   ```

   릴리스 빌드를 만들 때는 릴리스 키스토어로 뽑은 해시도 추가로 등록해야 한다.
4. **제품 설정 > 카카오 로그인** 활성화. (동의항목은 기본값인 닉네임만 사용 — `MainActivity.kt`의
   `fetchUserAndNotify()`가 `kakaoAccount.profile.nickname`만 읽는다.)

### 2. local.properties 만들기

```bash
cp android/local.properties.example android/local.properties
# 이후 KAKAO_NATIVE_APP_KEY 값을 채워 넣기
```

`sdk.dir`은 Android Studio에서 프로젝트를 열면 자동으로 채워진다.

## 빌드 & 실행

Android Studio(Hedgehog 이상 권장)로 `android/` 폴더를 열면:

- Gradle Wrapper jar가 자동으로 생성/동기화된다 (이 저장소에는 `gradlew`/`gradlew.bat`
  스크립트와 `gradle-wrapper.properties`만 있고, 바이너리인 `gradle-wrapper.jar`는 커밋되어
  있지 않다 — 코드 생성 환경 특성상 바이너리를 만들 수 없었음. Android Studio가 최초 동기화
  시 자동으로 받아온다).
- `syncWebAssets` 태스크가 `frontend/`를 `app/src/main/assets/www/`로 복사한 뒤 빌드된다.
- Run ▶ 으로 에뮬레이터/실기기에 설치.

CLI로 하려면 (Gradle Wrapper 준비 후):

```bash
cd android
./gradlew assembleDebug   # 또는 gradlew.bat (Windows)
```

## 알려진 제약 / 확인 필요 사항

- **이 코드는 Android SDK/에뮬레이터가 없는 환경에서 작성되어, 실제 컴파일·실행 검증을 하지
  못했습니다.** Android Studio에서 열어 Gradle 동기화 및 빌드가 정상적으로 되는지 반드시
  확인해 주세요.
- 위치 권한(`ACCESS_FINE_LOCATION`)은 매니페스트에만 선언되어 있고, 런타임 권한 요청 다이얼로그는
  아직 없습니다 — 프론트엔드의 `geolocation.js`가 브라우저 Geolocation API를 쓰므로, 실기기에서
  권한 프롬프트가 기대대로 뜨는지 확인이 필요합니다.
- 딥링크로 앱을 다시 여는 시나리오(예: 카카오톡에서 앱 전환 후 복귀)는 `singleTask` 런치모드로만
  대응해뒀고, 별도 테스트는 하지 않았습니다.
