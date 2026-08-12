/* ── GPS ──────────────────────────────────────────────────────── */
function initGeolocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        p=>{userLoc={lat:p.coords.latitude,lng:p.coords.longitude};},
        ()=>{}, {timeout:5000});
}

/* ── 위치 접근권한 안내 ────────────────────────────────────────────
   글자 크기를 정한 뒤, 왜 위치가 필요한지 한 화면으로 설명하고
   [확인]을 누르면 그때 실제 권한 요청(안드로이드 권한 창)이 뜬다.
   허용하지 않아도 둘러보기는 가능하다 — 가까운 순 정렬만 빠진다. */

/* 정확한 위치(GPS 고정밀)로 요청한다.
   여로는 "몇 분 거리인지"가 핵심이라 대략적인 위치로는 쓸모가 적다. */
const locationPrecise = true;

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
    if (!navigator.geolocation) {
        showLocationPermissionError('이 기기/브라우저는 위치 정보를 지원하지 않아요. 설정에서 위치 서비스를 켜주세요.');
        return;
    }
    btn.disabled = true;
    btn.textContent = '위치 확인 중...';
    navigator.geolocation.getCurrentPosition(
        p => {
            if (persist) localStorage.setItem('yeoro_loc_pref', 'while-using');
            else localStorage.removeItem('yeoro_loc_pref');
            saveUserLocation(p);
            btn.disabled = false;
            btn.textContent = '확인';
            finalizeAuth();
        },
        (err) => {
            btn.disabled = false;
            btn.textContent = '확인';
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
