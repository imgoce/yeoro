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
/* 카카오 access token — 회원탈퇴 때 "카카오 연결 끊기"에 필요하다.
   저장소에 두지 않고 앱이 켜져 있는 동안만 들고 있는다
   (토큰을 기기에 남기지 않기 위해서다). */
let kakaoAccessToken = null;

async function finishBackendLogin(token, group, authType) {
    const profile = await fetchMyProfile(token);
    localStorage.setItem('yeoro_jwt', token);
    userSession = {
        loggedIn: authType !== 'guest', targetGroup: group,
        nickname: profile.nickname, userId: profile.id, authType,
    };
    localStorage.setItem('yeoro_last_user', JSON.stringify(userSession));

    /* 여행로그 동기화는 기다리지 않는다.
       처음 들어가는 화면은 홈이라 로그가 아직 없어도 되고,
       여기서 서버 응답을 기다리면 로그인 직후 화면이 버벅인다.
       (여행로그 탭을 열 때 renderTravelLog가 최신 내용을 다시 그린다) */
    syncTravelLogFromServer()
        .then(() => { if (typeof renderTravelLog === 'function') renderTravelLog(); })
        .catch(() => {});

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
        kakaoAccessToken = payload.accessToken;   // 탈퇴 시 카카오 연결 끊기에 쓴다
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
        /* 웹 경로는 서버가 code를 대신 교환하므로 화면에서는 카카오 토큰을 알 수 없다.
           탈퇴할 때 필요하면 그때 카카오 로그인을 한 번 더 받는다. */
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
    /* 이 조회를 기다리는 동안 로그인 화면이 멈춰 보이므로 시간을 제한한다 */
    const res = await fetchWithTimeout(`${API_CONFIG.API_BASE_URL}/users/me`, {
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
/* 서버가 늦게 답해도 화면이 멈춰 있지 않도록, 기다리는 시간을 정해 둔다.
   게스트는 서버 계정이 없어도 둘러볼 수 있어 오래 기다릴 이유가 없다. */
const GUEST_WAIT_MS = 2500;

function fetchWithTimeout(url, options = {}, ms = GUEST_WAIT_MS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { ...options, signal: ctrl.signal })
        .finally(() => clearTimeout(timer));
}

/* 로그인 버튼들을 한 번만 눌리게 하고, 누른 티가 나게 한다.
   (예전에는 눌러도 아무 변화가 없어 여러 번 누르게 됐다) */
let _authBusy = false;
function setAuthBusy(on, label) {
    _authBusy = on;
    const link = document.querySelector('.auth-link');
    document.querySelectorAll('.auth-actions button').forEach(b => { b.disabled = on; });
    if (link) link.textContent = on ? (label || '들어가는 중...') : '게스트로 둘러보기';
}

async function browseAsGuest() {
    if (_authBusy) return;                   // 연속으로 눌러도 한 번만 처리
    setAuthBusy(true);
    try {
        await runGuestLogin();
    } finally {
        setAuthBusy(false);
    }
}

async function runGuestLogin() {
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
        const res = await fetchWithTimeout(`${API_CONFIG.API_BASE_URL}/auth/guest`, { method: 'POST' });
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
    const prefs = loadPrefs();
    if (userSession.targetGroup==='5060') {
        applyFontFamily('5060');
        /* 글씨 크기를 한 번이라도 정한 적이 있으면 설정 창을 다시 띄우지 않는다.
           (로그인할 때마다 창이 뜨면 홈까지 들어가는 길이 길어져 버벅이는 느낌을 준다.
            나중에 바꾸고 싶으면 [내 정보 > 화면 설정]에서 언제든 조절할 수 있다) */
        if (prefs.sizeChosen) {
            applyFontSize(prefs.size);
            requestLocationThenEnter();
            return;
        }
        const slider = document.getElementById('fontsize-slider');
        const savedSize = parseInt((prefs.size || '').replace('%',''), 10);
        if (savedSize >= 90 && savedSize <= 160) slider.value = savedSize;
        onFontSliderInput(slider.value);   // 미리보기 초기 동기화
        new bootstrap.Modal(document.getElementById('fontSizeSettingModal')).show();
    } else {
        /* 유아동반 모드: 예쁜 둥근 폰트 + 저장된 크기(없으면 기본) */
        applyFontFamily('family');
        applyFontSize(prefs.sizeChosen ? prefs.size : '100%');
        requestLocationThenEnter();
    }
}

/* 모드별 기본 글꼴 — family 모드일 때 Jua(둥근 손글씨풍) 적용.
   단, 사용자가 [내 정보 > 화면 설정]에서 글씨체를 직접 골랐다면 그 선택이 우선한다. */
function applyFontFamily(group){
    const prefs = (typeof loadPrefs === 'function') ? loadPrefs() : null;
    if (prefs && prefs.fontExplicit) { applyFontStack(prefs.font); return; }

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
/* 글씨 크기 적용 — 온보딩에서 고른 크기도 기기에 저장해두어
   [내 정보 > 화면 설정]에 그대로 표시되고, 다음에 열 때도 유지된다. */
function setFont(s){
    if (typeof setPrefFontSize === 'function') { setPrefFontSize(s); return; }
    document.getElementById('app-root-wrapper').style.setProperty('--app-font-size', s);
}
/* 로그인 화면의 여행 모드 알약 — 고른 쪽만 흰색으로 채운다.
   라디오는 여기서 직접 체크하고 색도 직접 칠한다.
   (다른 화면의 선택 버튼들도 같은 방식이라 동작이 한결같다) */
function setTravelMode(value) {
    const radio = document.querySelector(`input[name="loginTargetRadio"][value="${value}"]`);
    if (radio) radio.checked = true;

    document.querySelectorAll('.auth-mode-opt').forEach(el => {
        const input = document.getElementById(el.getAttribute('for'));
        const on = !!input && input.value === value;
        el.style.background  = on ? '#fff' : 'rgba(255,255,255,.16)';
        el.style.borderColor = on ? '#fff' : 'rgba(255,255,255,.34)';
        el.style.color       = on ? 'var(--yeoro-blue)' : '#fff';
    });
}

function finalizeAuth() {
    document.getElementById('user-profile-indicator').textContent=userSession.nickname;
    /* 히어로 문구는 고정 문구를 그대로 둔다.
       인사말은 예전 디자인의 흔적이라 새 배너에서는 쓰지 않는다. */
    if (typeof renderHomeWeather === 'function') renderHomeWeather();
    renderProfile();
    changeScreen('main');
    initGeolocation();
}
