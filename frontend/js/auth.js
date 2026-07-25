/* ── 카카오 로그인 ───────────────────────────────────────────────
   ▸ 안드로이드 앱(WebView)에서 실행 중이면: window.YeoroNative.startKakaoLogin()을
     호출해 네이티브 카카오 SDK로 위임한다. 카카오/구글 등은 임베디드 WebView의
     User-Agent를 감지해 로그인을 차단하므로("disallowed_useragent"), WebView
     안에서 카카오 로그인 페이지를 직접 여는 것은 시도하지 않는다.
     네이티브(MainActivity.kt)가 로그인 완료 후 window.onNativeKakaoLoginResult(...)를
     호출해 카카오 access_token을 돌려준다 — 아래 정의 참고.
   ▸ 일반 브라우저(순수 웹)에서 실행 중이면: 기존과 동일하게 카카오 OAuth 페이지로
     이동 → ?code= 콜백 → handleKakaoCallback().
   ▸ 두 경로 모두 최종적으로는 백엔드(/auth/kakao/token, /auth/kakao/callback)가
     카카오 access_token/code를 검증해 우리 자체 JWT를 발급한다 — 이메일 로그인과
     동일한 방식으로 이후 요청을 인증하고 여행기록도 서버와 동기화된다.
   ─────────────────────────────────────────────────────────────────*/
function startKakaoOAuth() {
    const group=document.querySelector('input[name="loginTargetRadio"]:checked')?.value||'5060';
    userSession.targetGroup=group;

    if (window.YeoroNative && typeof window.YeoroNative.startKakaoLogin === 'function') {
        window.YeoroNative.startKakaoLogin();
        return;
    }

    if (!API_CONFIG.KAKAO_REST_KEY) {
        showToast('카카오 로그인이 아직 설정되지 않았어요', 'error');
        return;
    }
    const state=btoa(JSON.stringify({group,r:Math.random().toString(36).slice(2)}));
    sessionStorage.setItem('oauth_state',state);
    const p=new URLSearchParams({client_id:API_CONFIG.KAKAO_REST_KEY,
        redirect_uri:API_CONFIG.KAKAO_REDIRECT_URI,response_type:'code',state});
    window.location.href='https://kauth.kakao.com/oauth/authorize?'+p;
}

/* 카카오/게스트 로그인 공통 마무리 — 백엔드가 발급한 JWT로 내 프로필을 조회하고
   세션을 이메일 로그인과 동일한 형태로 구성한다.
   게스트는 실제 신원이 없는 임시 계정이라는 걸 UI에서 계속 구분해야 하므로
   loggedIn은 이메일/카카오만 true, 게스트는 그대로 false로 둔다. */
async function finishBackendLogin(token, group, authType) {
    const profile = await fetchMyProfile(token);
    localStorage.setItem('yeoro_jwt', token);
    userSession = {
        loggedIn: authType !== 'guest', targetGroup: group,
        nickname: profile.nickname, userId: profile.id, authType,
    };
    localStorage.setItem('yeoro_last_user', JSON.stringify(userSession));
    await syncTravelLogFromServer();
    afterAuth();
}

/* 안드로이드 네이티브(MainActivity.kt)가 카카오 SDK 로그인 결과를 돌려줄 때 호출.
   success=true면 message는 {accessToken} JSON 문자열, false면 에러 메시지 문자열. */
async function onNativeKakaoLoginResult(success, message) {
    if (!success) {
        showToast(message || '카카오 로그인 실패', 'error');
        return;
    }
    let payload = {};
    try { payload = JSON.parse(message); } catch (e) {}
    if (!payload.accessToken) {
        showToast('카카오 로그인 정보를 받지 못했어요', 'error');
        return;
    }
    const group = userSession.targetGroup || '5060';
    try {
        const res = await fetch(`${API_CONFIG.API_BASE_URL}/auth/kakao/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: payload.accessToken }),
        });
        if (!res.ok) throw new Error('카카오 로그인 검증에 실패했어요');
        const { access_token } = await res.json();
        await finishBackendLogin(access_token, group, 'kakao');
    } catch (e) {
        showToast(e.message || '카카오 로그인 중 오류가 발생했어요', 'error');
    }
}

async function handleKakaoCallback() {
    const p=new URLSearchParams(window.location.search);
    const code=p.get('code'), state=p.get('state'), error=p.get('error');
    if (!code) return;
    window.history.replaceState({},'',window.location.pathname);
    if (error){showToast('카카오 로그인 취소됨');return;}
    if (sessionStorage.getItem('oauth_state')!==state){showToast('보안 검증 실패','error');return;}
    sessionStorage.removeItem('oauth_state');
    let group='5060';
    try{group=JSON.parse(atob(state)).group;}catch(e){}
    try {
        const res = await fetch(`${API_CONFIG.API_BASE_URL}/auth/kakao/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redirect_uri: API_CONFIG.KAKAO_REDIRECT_URI }),
        });
        if (!res.ok) throw new Error('카카오 로그인 검증에 실패했어요');
        const { access_token } = await res.json();
        await finishBackendLogin(access_token, group, 'kakao');
    } catch (e) {
        showToast(e.message || '카카오 로그인 중 오류가 발생했어요', 'error');
    }
}

/* ── 아이디(이메일)/비밀번호 회원가입·로그인 ─────────────────────
   백엔드(FastAPI)의 /auth/register, /auth/login을 호출해 JWT를 받고,
   이후 요청은 이 토큰(Authorization: Bearer ...)으로 인증한다.
   로그인/회원가입에 성공하면 여행기록을 서버와 동기화한다.
   ─────────────────────────────────────────────────────────────────*/
let emailAuthMode = 'register';   // 'login' 또는 'register' — 모달은 회원가입 모드로 열림

function toggleEmailAuthMode() {
    emailAuthMode = emailAuthMode === 'login' ? 'register' : 'login';
    const isRegister = emailAuthMode === 'register';
    document.getElementById('email-auth-title').textContent = isRegister ? '아이디로 회원가입' : '아이디로 로그인';
    document.getElementById('email-auth-nickname').classList.toggle('hidden', !isRegister);
    document.getElementById('email-auth-submit-btn').textContent = isRegister ? '회원가입' : '로그인';
    document.getElementById('email-auth-toggle-label').textContent = isRegister ? '이미 계정이 있으신가요?' : '계정이 없으신가요?';
    document.getElementById('email-auth-toggle-link').textContent = isRegister ? '로그인' : '회원가입';
    document.getElementById('email-auth-error').classList.add('hidden');
}

/* "10초 로그인으로 시작하기" 버튼 → 닉네임/이메일/비밀번호 회원가입 모달을 띄운다 */
function focusEmailRegisterForm() {
    if (emailAuthMode !== 'register') toggleEmailAuthMode();
    document.getElementById('email-auth-error').classList.add('hidden');
    const modalEl = document.getElementById('emailAuthModal');
    new bootstrap.Modal(modalEl).show();
    modalEl.addEventListener('shown.bs.modal', () => {
        document.getElementById('email-auth-nickname')?.focus();
    }, { once: true });
}

function showEmailAuthError(message) {
    const el = document.getElementById('email-auth-error');
    el.textContent = message;
    el.classList.remove('hidden');
}

async function handleEmailAuthSubmit() {
    const group = document.querySelector('input[name="loginTargetRadio"]:checked')?.value || '5060';
    const email = document.getElementById('email-auth-email').value.trim();
    const nickname = document.getElementById('email-auth-nickname').value.trim();
    const password = document.getElementById('email-auth-password').value;
    const submitBtn = document.getElementById('email-auth-submit-btn');

    if (!email || !password) { showEmailAuthError('이메일과 비밀번호를 입력해주세요'); return; }
    if (password.length < 8) { showEmailAuthError('비밀번호는 8자 이상이어야 해요'); return; }
    if (emailAuthMode === 'register' && nickname.length < 2) { showEmailAuthError('닉네임은 2자 이상이어야 해요'); return; }

    submitBtn.disabled = true;
    document.getElementById('email-auth-error').classList.add('hidden');
    try {
        if (emailAuthMode === 'register') {
            await registerWithEmail(email, nickname, password);
        }
        const token = await loginWithEmail(email, password);
        const profile = await fetchMyProfile(token);

        localStorage.setItem('yeoro_jwt', token);
        userSession = {
            loggedIn: true, targetGroup: group,
            nickname: profile.nickname, userId: profile.id, authType: 'email',
        };
        localStorage.setItem('yeoro_last_user', JSON.stringify(userSession));
        await syncTravelLogFromServer();
        bootstrap.Modal.getInstance(document.getElementById('emailAuthModal'))?.hide();
        afterAuth();
    } catch (e) {
        showEmailAuthError(e.message || '처리 중 오류가 발생했어요');
    } finally {
        submitBtn.disabled = false;
    }
}

async function registerWithEmail(email, nickname, password) {
    const res = await fetch(`${API_CONFIG.API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nickname, password }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || '회원가입에 실패했어요');
    }
    return await res.json();
}

async function loginWithEmail(email, password) {
    const res = await fetch(`${API_CONFIG.API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || '이메일 또는 비밀번호가 올바르지 않아요');
    }
    const data = await res.json();
    return data.access_token;
}

async function fetchMyProfile(token) {
    const res = await fetch(`${API_CONFIG.API_BASE_URL}/users/me`, {
        headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!res.ok) throw new Error('내 정보를 불러오지 못했어요');
    const data = await res.json();
    return data.user;
}

/* ── 게스트 둘러보기 ────────────────────────────────────────────
   백엔드에 익명 계정을 만들어 JWT를 발급받는다 (/auth/guest). 같은
   기기에서 재방문 시에는 저장해둔 토큰을 재사용해 계정이 계속 늘어나지
   않도록 한다. 새 기기/재설치 시에는 새 게스트 계정이 만들어진다. */
async function browseAsGuest() {
    const group=document.querySelector('input[name="loginTargetRadio"]:checked')?.value||'5060';
    const cachedToken = localStorage.getItem('yeoro_jwt');
    const cachedSession = JSON.parse(localStorage.getItem('yeoro_last_user') || 'null');

    if (cachedToken && cachedSession?.authType === 'guest') {
        try {
            await finishBackendLogin(cachedToken, group, 'guest');
            return;
        } catch (e) {
            /* 토큰이 만료됐거나 무효화됐으면 새 게스트 계정으로 폴백 */
        }
    }

    try {
        const res = await fetch(`${API_CONFIG.API_BASE_URL}/auth/guest`, { method: 'POST' });
        if (!res.ok) throw new Error('backend guest failed');
        const { access_token } = await res.json();
        await finishBackendLogin(access_token, group, 'guest');
    } catch (e) {
        /* 백엔드에 연결하지 못하면(서버 미실행/오프라인) 로컬 게스트로 진입한다.
           기록은 이 기기에만 저장되고, 로그인 시 서버와 동기화된다. */
        let guestId = localStorage.getItem('yeoro_guest_id');
        if (!guestId) {
            guestId = 'guest_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
            localStorage.setItem('yeoro_guest_id', guestId);
        }
        userSession = { loggedIn: false, targetGroup: group, nickname: '게스트', userId: guestId, authType: 'guest' };
        localStorage.setItem('yeoro_last_user', JSON.stringify(userSession));
        afterAuth();
    }
}

function afterAuth() {
    /* 로그인/게스트/회원가입 직후 → 로그인 오버레이 닫고 → 튜토리얼 → 메인 */
    hideAuthScreen();
    maybeShowOnboarding();
}

/* 온보딩이 끝나면(또는 건너뛰면) 호출 → 모드별 처리 후 메인으로
   ▸ 5060 모드     : 글자 크기 슬라이더 모달을 띄워 사용자가 직접 조정
   ▸ 유아동반 모드 : 둥글고 친근한 폰트(Jua)로 교체 후 바로 진입       */
function proceedAfterOnboarding() {
    if (userSession.targetGroup==='5060') {
        applyFontFamily('5060');
        const slider = document.getElementById('fontsize-slider');
        onFontSliderInput(slider.value);   // 미리보기 초기 동기화
        new bootstrap.Modal(document.getElementById('fontSizeSettingModal')).show();
    } else {
        /* 유아동반 모드: 예쁜 둥근 폰트 + 기본 크기 */
        applyFontFamily('family');
        setFont('100%');
        requestLocationThenEnter();
    }
}

/* 모드별 글꼴 적용 — family 모드일 때 Jua(둥근 손글씨풍) 적용 */
function applyFontFamily(group){
    const root = document.getElementById('app-root-wrapper');
    if (group==='family') {
        root.style.setProperty('--app-font-family', "'Jua', 'Noto Sans KR', sans-serif");
    } else {
        root.style.setProperty('--app-font-family', "'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif");
    }
}

/* 슬라이더 입력 → 실시간 미리보기 + 라벨 갱신 */
function onFontSliderInput(val){
    const pct = parseInt(val, 10);
    fontChoice = pct + '%';
    /* 미리보기 글자에 비율 반영 (90~160% → 1.0~1.8rem 정도) */
    const preview = document.getElementById('fontsize-preview');
    if (preview) preview.style.fontSize = (pct/100 * 1.0 + 0.15) + 'rem';
    /* 라벨 */
    const labelEl = document.getElementById('fontsize-value');
    let label;
    if (pct <= 95)      label = '작게';
    else if (pct <= 110) label = '기본 크기';
    else if (pct <= 135) label = '크게 (시니어 추천)';
    else                 label = '아주 크게';
    if (labelEl) labelEl.textContent = `${label} (${pct}%)`;
}

function confirmFontSizeAndGoHome(){
    setFont(fontChoice);
    bootstrap.Modal.getInstance(document.getElementById('fontSizeSettingModal'))?.hide();
    requestLocationThenEnter();
}
function setFont(s){document.getElementById('app-root-wrapper').style.setProperty('--app-font-size',s);}
function finalizeAuth() {
    document.getElementById('user-profile-indicator').textContent=userSession.nickname;
    document.getElementById('main-welcome-msg').innerHTML=
        `반갑습니다, ${esc(userSession.nickname)}님`;
    /* 안내 문구 대신 날씨 문구를 표시 (home-weather-line은 환영 문구와 별개 요소) */
    if (typeof renderHomeWeather === 'function') renderHomeWeather();
    renderProfile();
    changeScreen('main');
    initGeolocation();
}
