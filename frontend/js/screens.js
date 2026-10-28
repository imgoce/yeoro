/* ── 화면 전환 ────────────────────────────────────────────────── */
function changeScreen(id) {
    ['login','main','schedule','api-list','history','product'].forEach(s=>
        document.getElementById('screen-'+s)?.classList.add('hidden'));
    document.getElementById('screen-'+id)?.classList.remove('hidden');
    /* 하단바 순서: 홈 · 추천일정 · 장바구니 · 여행로그 · MY
       장바구니(2번)는 화면이 아니라 창을 여는 버튼이라 선택 표시가 없다. */
    document.querySelectorAll('.nav-item').forEach((t,i)=>t.classList.toggle('active',
        (id==='main'&&i===0)||(id==='schedule'&&i===1)||(id==='history'&&i===3)||(id==='login'&&i===4)));
    if (id==='history') renderTravelLog();
    if (id==='main')    renderHomeSpots();   // 홈 "세종 대표 명소" 채우기
    if (id==='login') {
        renderProfile();          // 내 정보 탭 진입 시 프로필 갱신
        refreshPrefButtons();     // 화면 설정 버튼에 현재 선택 표시
    }
}

/* ── 시작 로그인 페이지(독립 오버레이) 열기/닫기 ──────────────── */
function goToAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
}
function hideAuthScreen() {
    document.getElementById('auth-screen').classList.add('hidden');
}

/* ── 프로필(내 정보) 렌더링 ───────────────────────────────────── */
function renderProfile() {
    const nick = document.getElementById('profile-nickname');
    const type = document.getElementById('profile-authtype');
    const loginRow  = document.getElementById('profile-login-row');
    const logoutRow = document.getElementById('profile-logout-row');
    const modeLabel = document.getElementById('profile-mode-label');
    const modeIcon  = document.getElementById('profile-mode-icon');
    if (!nick) return;

    nick.textContent = userSession.nickname || '게스트';
    const typeMap = {kakao:'카카오 로그인', email:'아이디 로그인', guest:'게스트 (이 기기에서만 이어짐)'};
    type.textContent = userSession.userId ? (typeMap[userSession.authType]||'') : '로그인이 필요해요';

    if (userSession.targetGroup==='family') {
        modeLabel.textContent='영유아 동반 부모 코스'; modeIcon.textContent='child_friendly';
    } else {
        modeLabel.textContent='5060 액티브 시니어'; modeIcon.textContent='accessibility_new';
    }

    /* 로그인 상태면 로그아웃, 게스트/미로그인이면 로그인 버튼 노출.
       회원탈퇴는 실제 계정이 있는 회원에게만 보여준다 —
       게스트는 서버에 지울 계정이 없다. */
    const isMember = userSession.loggedIn;
    loginRow.style.display  = isMember ? 'none' : 'flex';
    logoutRow.style.display = isMember ? 'flex' : 'none';
    const withdrawRow = document.getElementById('profile-withdraw-row');
    if (withdrawRow) withdrawRow.style.display = isMember ? 'flex' : 'none';
}

/* ── 약관·방침 보기 ───────────────────────────────────────────────
   문서 본문은 policy-data.js에 함께 담아 두었다. 앱은 화면을 file://로
   열기 때문에 옆의 html 파일을 fetch로 읽으면 보안 정책에 막혀
   "불러오지 못했어요"가 뜬다. */
function openPolicy(kind = 'privacy') {
    const box = document.getElementById('policy-body');
    new bootstrap.Modal(document.getElementById('policyModal')).show();

    const html = (typeof POLICY_HTML !== 'undefined') ? POLICY_HTML[kind] : null;
    box.innerHTML = html || '<p>문서를 불러오지 못했어요.</p>';
    box.scrollTop = 0;
    box.parentElement.scrollTop = 0;   // 창을 다시 열면 맨 위부터 읽도록
}

/* ── 약관 동의 (로그인 전 필수) ────────────────────────────────────
   두 항목 모두 체크해야 [동의하고 시작하기]가 눌린다.
   한 번 동의하면 기록해 두고 다시 묻지 않는다.
   문서 내용이 바뀌면 아래 번호를 올려 다시 받으면 된다. */
const AGREE_KEY = 'yeoro_agreed_v1';

function hasAgreed() {
    return localStorage.getItem(AGREE_KEY) !== null;
}

/* 체크 상태에 따라 '모두 동의'와 시작 버튼을 맞춘다 */
function refreshAgreeState() {
    const p = document.getElementById('agree-privacy').checked;
    const t = document.getElementById('agree-terms').checked;
    document.getElementById('agree-all').checked = p && t;
    document.getElementById('agree-submit').disabled = !(p && t);
}

function toggleAgreeAll(on) {
    document.getElementById('agree-privacy').checked = on;
    document.getElementById('agree-terms').checked = on;
    refreshAgreeState();
}

/* ── 서버 깨우기 ──────────────────────────────────────────────────
   서버는 한동안 요청이 없으면 잠들어 있다가 첫 요청에 몇 초 걸린다.
   그 몇 초를 로그인 누른 뒤에 겪으면 "안 눌린다"처럼 보이므로,
   약관 동의 화면을 띄우기 전에 미리 깨워 둔다.
   너무 오래 붙잡지 않도록 최대 8초만 기다리고 그냥 진행한다. */
const WAKE_MAX_MS = 8000;

async function wakeServerThenStart() {
    const screen = document.getElementById('wake-screen');
    const sub = document.getElementById('wake-sub');
    screen.classList.remove('hidden');

    /* 오래 걸리면 왜 기다리는지 알려준다 */
    const slowTimer = setTimeout(() => {
        if (sub) sub.textContent = '서버를 깨우는 중이에요.\n처음 실행할 때는 조금 걸릴 수 있어요';
    }, 2500);

    try {
        const ctrl = new AbortController();
        const cut = setTimeout(() => ctrl.abort(), WAKE_MAX_MS);
        await fetch(`${API_CONFIG.API_BASE_URL}/health`, { signal: ctrl.signal });
        clearTimeout(cut);
    } catch (e) {
        /* 못 깨워도 그냥 진행한다 — 게스트 둘러보기는 서버 없이도 된다 */
    }
    clearTimeout(slowTimer);
    screen.classList.add('hidden');

    /* 지난번에 로그인했다면 로그인 화면을 건너뛰고 바로 홈으로 */
    if (restoreSession()) return;
    showAgreeScreen();
}

/* ── 자동 로그인 ───────────────────────────────────────────────────
   저장해 둔 로그인 기록이 있으면 그대로 이어서 홈으로 들어간다.
   서버 확인을 기다리지 않고 먼저 들어간 뒤, 뒤에서 토큰이 아직
   쓸 수 있는지 확인한다 — 만료됐으면 그때 로그인 화면으로 돌린다.
   약관에 동의한 적이 없으면 자동 로그인하지 않는다. */
function restoreSession() {
    if (!hasAgreed()) return false;

    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('yeoro_last_user') || 'null'); } catch (e) {}
    if (!saved || !saved.userId) return false;

    userSession = saved;
    hideAuthScreen();
    renderProfile();
    proceedAfterOnboarding();          // 글자 크기·위치 단계를 거쳐 홈으로
    verifySessionInBackground();
    return true;
}

async function verifySessionInBackground() {
    const token = localStorage.getItem('yeoro_jwt');
    if (!token) return;                // 로컬 게스트는 서버 계정이 없어 확인할 것이 없다
    try {
        const res = await fetch(`${API_CONFIG.API_BASE_URL}/users/me`, {
            headers: { Authorization: 'Bearer ' + token },
        });
        if (res.status === 401 || res.status === 403) {
            /* 탈퇴했거나 기간이 지난 토큰 — 조용히 정리하고 다시 로그인받는다 */
            showToast('로그인이 만료되어 다시 로그인이 필요해요');
            handleLogout();
        }
    } catch (e) { /* 통신이 안 되면 그대로 둔다 (오프라인에서도 쓸 수 있게) */ }
}

/* 동의 화면 열기 — 이미 동의했으면 건너뛰고 바로 로그인으로 */
function showAgreeScreen() {
    if (hasAgreed()) { goToAuthScreen(); return; }
    /* 동의하기 전에는 로그인 화면을 아예 내려둔다 —
       뒤에 깔려 있으면 동의 없이 들어간 것처럼 보일 수 있다. */
    hideAuthScreen();
    toggleAgreeAll(false);
    document.getElementById('agree-screen').classList.remove('hidden');
}

function acceptAgreements() {
    if (!document.getElementById('agree-privacy').checked ||
        !document.getElementById('agree-terms').checked) return;
    /* 언제 무엇에 동의했는지 남겨 둔다 */
    localStorage.setItem(AGREE_KEY, JSON.stringify({
        privacy: true, terms: true, at: new Date().toISOString(),
    }));
    document.getElementById('agree-screen').classList.add('hidden');
    goToAuthScreen();
}

/* ── 회원탈퇴 ──────────────────────────────────────────────────────
   되돌릴 수 없는 일이라 확인 창을 한 번 거친다.
   서버에서 계정과 개인 기록을 지우고, 이 기기에 남은 것도 함께 지운다. */
function openWithdrawConfirm() {
    if (!userSession.loggedIn) {
        showToast('로그인한 회원만 탈퇴할 수 있어요');
        return;
    }
    document.getElementById('withdraw-who').textContent = userSession.nickname || '회원';
    /* 카카오 회원에게만 "카카오 연결 해제" 안내를 보여준다 */
    document.getElementById('withdraw-kakao-note').style.display =
        userSession.authType === 'kakao' ? 'block' : 'none';
    new bootstrap.Modal(document.getElementById('withdrawModal')).show();
}

async function confirmWithdraw() {
    const btn = document.getElementById('withdraw-confirm-btn');
    btn.disabled = true;
    btn.textContent = '탈퇴 처리 중...';

    const headers = { Authorization: 'Bearer ' + localStorage.getItem('yeoro_jwt') };
    /* 카카오 회원은 카카오 쪽 연결도 함께 끊어야 해서 토큰이 필요하다 */
    if (userSession.authType === 'kakao') {
        if (!kakaoAccessToken) {
            btn.disabled = false;
            btn.textContent = '탈퇴하기';
            showToast('카카오 확인이 필요해요. 카카오로 다시 로그인한 뒤 탈퇴해주세요', 'error');
            return;
        }
        headers['X-Kakao-Access-Token'] = kakaoAccessToken;
    }

    try {
        const res = await fetch(`${API_CONFIG.API_BASE_URL}/users/me`, { method: 'DELETE', headers });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.detail || '탈퇴 처리에 실패했어요');
        }
    } catch (e) {
        btn.disabled = false;
        btn.textContent = '탈퇴하기';
        showToast(e.message || '서버에 연결하지 못했어요', 'error');
        return;
    }

    clearLocalAccountData();
    bootstrap.Modal.getInstance(document.getElementById('withdrawModal'))?.hide();
    btn.disabled = false;
    btn.textContent = '탈퇴하기';
    showToast('탈퇴가 완료되었어요. 그동안 이용해주셔서 감사합니다');
    goToAuthScreen();
}

/* 이 기기에 남아 있는 계정 흔적을 모두 지운다 */
function clearLocalAccountData() {
    if (window.YeoroNative && typeof window.YeoroNative.logoutKakao === 'function') {
        try { window.YeoroNative.logoutKakao(); } catch (e) {}
    }
    const userId = userSession.userId;
    ['yeoro_jwt', 'yeoro_last_user', 'yeoro_guest_id'].forEach(k => localStorage.removeItem(k));
    if (userId) localStorage.removeItem('yeoro_log_' + userId);

    kakaoAccessToken = null;
    cart = [];
    if (typeof syncCartBadge === 'function') syncCartBadge();
    userSession = { loggedIn:false, targetGroup:'5060', nickname:'게스트', userId:null, authType:null };
    document.getElementById('user-profile-indicator').textContent = '시작하기';
    applyFontFamily('5060');
    setFont('100%');
    renderProfile();
}

function handleLogout() {
    /* 앱이면 카카오 세션도 함께 끊는다.
       이걸 안 하면 로그아웃해도 카카오 토큰이 기기에 남아,
       카카오 버튼을 다시 누르는 순간 곧바로 재로그인된다. */
    if (window.YeoroNative && typeof window.YeoroNative.logoutKakao === 'function') {
        try { window.YeoroNative.logoutKakao(); } catch (e) {}
    }
    localStorage.removeItem('yeoro_last_user');
    localStorage.removeItem('yeoro_jwt');
    userSession = { loggedIn:false, targetGroup:'5060', nickname:'게스트', userId:null, authType:null };
    document.getElementById('user-profile-indicator').textContent='시작하기';
    /* 폰트/크기 기본값으로 복원 */
    applyFontFamily('5060');
    setFont('100%');
    showToast('로그아웃 되었어요');
    goToAuthScreen();
}
