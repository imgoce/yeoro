/* ── GPS ──────────────────────────────────────────────────────── */
function initGeolocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        p=>{userLoc={lat:p.coords.latitude,lng:p.coords.longitude};},
        ()=>{}, {timeout:5000});
}

/* ── 위치 정보 허용 게이트 ─────────────────────────────────────────
   회원가입/로그인/게스트 둘러보기 공통 경로: 글자 크기를 정한 뒤,
   위치 정보를 허용해야만 메인 화면(finalizeAuth)으로 들어갈 수 있다.
   안드로이드 네이티브 권한 창처럼 [정확한 위치/대략적인 위치] 선택과
   [앱 사용 중에만 허용/이번만 허용/허용 안함] 3가지 버튼을 제공한다. */

/* true = 정확한 위치(GPS 고정밀) / false = 대략적인 위치(저전력·기지국 수준) */
let locationPrecise = true;

function setLocationPrecision(precise) {
    locationPrecise = precise;
    const pre = document.getElementById('loc-precise-opt').firstElementChild;
    const apx = document.getElementById('loc-approx-opt').firstElementChild;
    const preLb = document.getElementById('loc-precise-label');
    const apxLb = document.getElementById('loc-approx-label');
    pre.style.borderColor = precise ? 'var(--yeoro-blue)' : 'transparent';
    apx.style.borderColor = precise ? 'transparent' : 'var(--yeoro-blue)';
    preLb.style.fontWeight = precise ? '800' : '500';
    preLb.style.color = precise ? '' : 'var(--yeoro-muted)';
    apxLb.style.fontWeight = precise ? '500' : '800';
    apxLb.style.color = precise ? 'var(--yeoro-muted)' : '';
}

function requestLocationThenEnter() {
    document.getElementById('location-permission-error').classList.add('hidden');
    /* "앱 사용 중에만 허용"을 선택했던 사용자는 다음부터 게이트 없이 바로 위치를 잡는다 */
    if (localStorage.getItem('yeoro_loc_pref') === 'while-using' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            p => { saveUserLocation(p); finalizeAuth(); },
            () => { document.getElementById('location-permission-screen').classList.remove('hidden'); },
            { timeout: 20000, enableHighAccuracy: locationPrecise }
        );
        return;
    }
    document.getElementById('location-permission-screen').classList.remove('hidden');
}

/* 좌표 저장 — 길찾기 시 카카오맵 출발지 자동 입력에 그대로 쓰인다 */
function saveUserLocation(p) {
    userLoc = { lat: p.coords.latitude, lng: p.coords.longitude };
    document.getElementById('location-permission-screen').classList.add('hidden');
}

/* persist=true → "앱 사용 중에만 허용" (선택 기억), false → "이번만 허용" */
function handleLocationPermissionRequest(persist) {
    const btn = document.getElementById('location-permission-btn');
    const onceBtn = document.getElementById('location-permission-once-btn');
    if (!navigator.geolocation) {
        showLocationPermissionError('이 기기/브라우저는 위치 정보를 지원하지 않아요. 설정에서 위치 서비스를 켜주세요.');
        return;
    }
    btn.disabled = true; onceBtn.disabled = true;
    (persist ? btn : onceBtn).textContent = '위치 확인 중...';
    navigator.geolocation.getCurrentPosition(
        p => {
            if (persist) localStorage.setItem('yeoro_loc_pref', 'while-using');
            else localStorage.removeItem('yeoro_loc_pref');
            saveUserLocation(p);
            btn.disabled = false; onceBtn.disabled = false;
            btn.textContent = '앱 사용 중에만 허용';
            onceBtn.textContent = '이번만 허용';
            finalizeAuth();
        },
        (err) => {
            btn.disabled = false; onceBtn.disabled = false;
            btn.textContent = '앱 사용 중에만 허용';
            onceBtn.textContent = '이번만 허용';
            // 권한을 막 허용한 직후 첫 요청은 기기의 위치 서비스가 준비되는 데 시간이 걸려
            // 타임아웃(code 3)이 나기도 한다. 이 경우는 권한 문제가 아니므로 안내 문구를 다르게 준다.
            const message = err.code === err.TIMEOUT
                ? '위치를 확인하는 데 시간이 걸리고 있어요. 잠시 후 다시 시도해주세요.'
                : '위치 정보 허용이 필요해요. 브라우저·기기 설정에서 여로의 위치 권한을 허용한 뒤 다시 시도해주세요.';
            showLocationPermissionError(message);
        },
        /* 정확한 위치 = GPS 고정밀, 대략적인 위치 = 저전력(네트워크 기반) */
        { timeout: 20000, enableHighAccuracy: locationPrecise }
    );
}

/* "허용 안함" — 세종시청 기준 기본 좌표로 진행 (길찾기 출발지는 직접 입력해야 함) */
function denyLocationPermission() {
    localStorage.removeItem('yeoro_loc_pref');
    userLoc = { lat: API_CONFIG.DEFAULT_LAT, lng: API_CONFIG.DEFAULT_LNG };
    document.getElementById('location-permission-screen').classList.add('hidden');
    showToast('위치 없이 시작해요 — 거리·길찾기는 세종시청 기준으로 보여드려요');
    finalizeAuth();
}

function showLocationPermissionError(message) {
    const el = document.getElementById('location-permission-error');
    el.textContent = message;
    el.classList.remove('hidden');
}
