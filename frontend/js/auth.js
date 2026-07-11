/* ── 카카오 로그인 ───────────────────────────────────────────────
   ▸ 안드로이드 앱(WebView)에서 실행 중이면: window.YeoroNative.startKakaoLogin()을
     호출해 네이티브 카카오 SDK로 위임한다. 카카오/구글 등은 임베디드 WebView의
     User-Agent를 감지해 로그인을 차단하므로("disallowed_useragent"), WebView
     안에서 카카오 로그인 페이지를 직접 여는 것은 시도하지 않는다.
     네이티브(MainActivity.kt)가 로그인 완료 후 window.onNativeKakaoLoginResult(...)를
     호출해 결과를 돌려준다 — 아래 정의 참고.
   ▸ 일반 브라우저(순수 웹)에서 실행 중이면: 기존과 동일하게 카카오 OAuth 페이지로
     이동 → ?code= 콜백 → handleKakaoCallback().
   ─────────────────────────────────────────────────────────────────*/
function startKakaoOAuth() {
    const group=document.querySelector('input[name="loginTargetRadio"]:checked')?.value||'5060';
    userSession.targetGroup=group;

    if (window.YeoroNative && typeof window.YeoroNative.startKakaoLogin === 'function') {
        window.YeoroNative.startKakaoLogin();
        return;
    }

    if (!API_CONFIG.KAKAO_REST_KEY) {
        showToast('카카오 키 미설정 → 데모 카카오 로그인으로 진행합니다');
        /* 데모 모드: 실제 OAuth 없이 카카오 회원으로 즉시 로그인 처리 */
        const kakaoUserId = 'kakao_demo_user';
        userSession = {loggedIn:true, targetGroup:group, nickname:'카카오 회원', userId:kakaoUserId, authType:'kakao'};
        localStorage.setItem('yeoro_last_user', JSON.stringify(userSession));
        afterAuth();
        return;
    }
    const state=btoa(JSON.stringify({group,r:Math.random().toString(36).slice(2)}));
    sessionStorage.setItem('oauth_state',state);
    const p=new URLSearchParams({client_id:API_CONFIG.KAKAO_REST_KEY,
        redirect_uri:API_CONFIG.KAKAO_REDIRECT_URI,response_type:'code',state});
    window.location.href='https://kauth.kakao.com/oauth/authorize?'+p;
}

/* 안드로이드 네이티브(MainActivity.kt)가 카카오 SDK 로그인 결과를 돌려줄 때 호출.
   success=true면 message는 {userId, nickname} JSON 문자열, false면 에러 메시지 문자열. */
function onNativeKakaoLoginResult(success, message) {
    if (!success) {
        showToast(message || '카카오 로그인 실패', 'error');
        return;
    }
    let payload = {};
    try { payload = JSON.parse(message); } catch (e) {}
    const group = userSession.targetGroup || '5060';
    userSession = {
        loggedIn: true,
        targetGroup: group,
        nickname: payload.nickname || '카카오 회원',
        userId: payload.userId || 'kakao_native_user',
        authType: 'kakao',
    };
    localStorage.setItem('yeoro_last_user', JSON.stringify(userSession));
    afterAuth();
}
function handleKakaoCallback() {
    const p=new URLSearchParams(window.location.search);
    const code=p.get('code'), state=p.get('state'), error=p.get('error');
    if (!code) return;
    window.history.replaceState({},'',window.location.pathname);
    if (error){showToast('카카오 로그인 취소됨');return;}
    if (sessionStorage.getItem('oauth_state')!==state){showToast('보안 검증 실패','error');return;}
    sessionStorage.removeItem('oauth_state');
    let group='5060';
    try{group=JSON.parse(atob(state)).group;}catch(e){}
    /* 실제 서비스에서는 백엔드에서 카카오 고유 ID(kakao_account.id)를 받아와야 함 */
    const kakaoUserId = 'kakao_' + code.slice(0,16);
    userSession={loggedIn:true, targetGroup:group, nickname:'카카오 회원', userId:kakaoUserId, authType:'kakao'};
    localStorage.setItem('yeoro_last_user', JSON.stringify(userSession));
    /* Flask 연동 시: fetch('/auth/kakao/callback?code='+code+'&state='+state) */
    afterAuth();
}

/* ── 게스트 둘러보기 — 기기별 고유 ID를 발급해 여행로그를 유지 ──── */
function browseAsGuest() {
    const group=document.querySelector('input[name="loginTargetRadio"]:checked')?.value||'5060';
    const guestId = getOrCreateGuestId();
    userSession={loggedIn:false, targetGroup:group, nickname:'게스트', userId:guestId, authType:'guest'};
    afterAuth();
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
        finalizeAuth();
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
    finalizeAuth();
}
function setFont(s){document.getElementById('app-root-wrapper').style.setProperty('--app-font-size',s);}
function finalizeAuth() {
    document.getElementById('user-profile-indicator').textContent=userSession.nickname;
    const guide=userSession.targetGroup==='5060'
        ?'현위치 기반 무장애 맞춤 가이드가 켜졌어요.'
        :'영유아 동반 코스 가이드가 켜졌어요.';
    document.getElementById('main-welcome-msg').innerHTML=
        `반갑습니다, ${esc(userSession.nickname)}님<br>
         <span style="font-size:.82em;font-weight:500;opacity:.88;">${guide}</span>`;
    renderProfile();
    changeScreen('main');
    initGeolocation();
}
