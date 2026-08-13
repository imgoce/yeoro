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
    /* 한 번 허용했던 사용자는 안내 화면 없이 바로 홈으로 들어간다.
       예전에는 여기서 GPS가 잡힐 때까지(최대 20초) 기다리느라
       로그인 후 화면이 멈춘 것처럼 보였다. 이제는 먼저 들어가고
       위치는 뒤에서 받아 거리 표시만 갱신한다. */
    if (localStorage.getItem('yeoro_loc_pref') === 'while-using' && navigator.geolocation) {
        finalizeAuth();
        refreshLocationInBackground();
        return;
    }
    document.getElementById('location-permission-screen').classList.remove('hidden');
}

/* 좌표 저장 — 길찾기 시 카카오맵 출발지 자동 입력에 그대로 쓰인다 */
function saveUserLocation(p) {
    userLoc = { lat: p.coords.latitude, lng: p.coords.longitude };
    document.getElementById('location-permission-screen').classList.add('hidden');
}

/* 위치를 뒤에서 받아 목록의 거리·소요시간만 갱신한다.
   홈에 들어가기 전에 GPS를 기다리면 몇 초씩 멈춰 있는 것처럼 보이므로,
   화면은 먼저 띄우고 위치는 도착하는 대로 반영한다. */
function refreshLocationInBackground() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        p => {
            const before = `${userLoc.lat},${userLoc.lng}`;
            saveUserLocation(p);
            if (before === `${userLoc.lat},${userLoc.lng}`) return;   // 그대로면 다시 그릴 것 없음
            /* 받아둔 목록은 기본 좌표 기준이라 거리를 다시 계산해야 한다 */
            if (typeof invalidatePlacesCache === 'function') invalidatePlacesCache();
            if (typeof renderHomeSpots === 'function') renderHomeSpots();
        },
        () => {},                       // 실패해도 기본 좌표로 그대로 쓴다
        { timeout: 15000, enableHighAccuracy: locationPrecise }
    );
}

/* persist=true → "앱 사용 중에만 허용" (선택 기억), false → "이번만 허용" */
function handleLocationPermissionRequest(persist) {
    const btn = document.getElementById('location-permission-btn');
    if (!navigator.geolocation) {
        showLocationPermissionError('이 기기/브라우저는 위치 정보를 지원하지 않아요. 설정에서 위치 서비스를 켜주세요.');
        return;
    }
    if (persist) localStorage.setItem('yeoro_loc_pref', 'while-using');
    else localStorage.removeItem('yeoro_loc_pref');

    /* 안내 화면은 바로 내리고 홈으로 들어간다.
       기기 권한 창과 GPS 측정은 뒤에서 진행되고, 위치가 도착하면
       refreshLocationInBackground가 거리 표시만 갱신한다.
       (예전에는 GPS가 잡힐 때까지 이 화면에 멈춰 있었다) */
    document.getElementById('location-permission-screen').classList.add('hidden');
    finalizeAuth();
    refreshLocationInBackground();
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
