/* ── 카테고리별 데이터 로딩 ──────────────────────────────────────
   각 카테고리마다 1~2개 API를 호출 → 병합 → 실패 시 폴백
   속도 전략(1초 이내 표시):
   ① localStorage 캐시(10분) → 재방문·재클릭 시 즉시 표시
   ② 실도로 거리(OSRM)는 렌더를 막지 않고 백그라운드에서 채운 뒤 라벨만 갱신
   ③ 앱 시작 직후 prefetchPlaces()가 전 카테고리를 미리 받아둠 → 첫 클릭도 즉시
   ─────────────────────────────────────────────────────────────────*/
const PLACES_CACHE_TTL = 10 * 60 * 1000;   // 10분
const PLACES_CACHE_VER = 'v2';

function loadPlacesFromStorage(category) {
    try {
        const raw = localStorage.getItem(`yeoro_places_${PLACES_CACHE_VER}_${category}`);
        if (!raw) return null;
        const { ts, places } = JSON.parse(raw);
        if (Date.now() - ts > PLACES_CACHE_TTL) return null;
        return places;
    } catch(e) { return null; }
}
function savePlacesToStorage(category, places) {
    try {
        localStorage.setItem(`yeoro_places_${PLACES_CACHE_VER}_${category}`,
            JSON.stringify({ ts: Date.now(), places }));
    } catch(e) { /* 저장공간 부족 등 — 캐시는 없어도 동작 */ }
}

/* 화면에 이미 그려진 카드의 거리 라벨을 실도로 값으로 갱신 (재정렬은 하지 않음) */
function updateVisibleDriveLabels(places) {
    places.forEach(p => {
        if (p._driveMin == null) return;
        const meta = document.querySelector(`.place-card[data-pid="${CSS.escape(p.id)}"] .place-meta`);
        if (meta) meta.textContent = `🚗 약 ${p._driveMin}분 (${p._driveKm}km) · 세종시`;
    });
}

async function getPlaces(category) {
    if (apiCache[category]) return apiCache[category];

    /* ① 저장 캐시 — 실도로 값까지 담겨 있어 즉시 완성형으로 표시 */
    const cached = loadPlacesFromStorage(category);
    if (cached) { apiCache[category] = cached; return cached; }

    let places = null;

    try {
        if (category === '관광명소') {
            /* 세종시로 분류된 볼거리를 전부 표시:
               관광지12 + 문화시설14 + 레포츠28 + 여행코스25 + 웰니스 */
            const [tour, culture, leports, course, wellness] = await Promise.all([
                callTourApi('12', 100),
                callTourApi('14', 100),
                callTourApi('28', 100),
                callTourApi('25', 100),
                callWellnessApi(8),
            ]);
            const combined = [...(tour||[]), ...(culture||[]), ...(leports||[]),
                              ...(course||[]), ...(wellness||[])];
            /* contentid 기준 중복 제거 */
            const seen = new Set();
            const deduped = combined.filter(p=>{
                if (seen.has(p.id)) return false;
                seen.add(p.id); return true;
            });
            if (deduped.length > 0) places = deduped;
        }
        else if (category === '먹거리') {
            /* 국문관광정보(음식점39) + 카카오맵(FD6 음식점) 병렬 호출 */
            const [tourFood, kakaoFood] = await Promise.all([
                callTourApi('39', 100),
                callKakaoCategory('FD6', 10),
            ]);
            const combined = [...(tourFood||[]), ...(kakaoFood||[])];
            if (combined.length > 0) places = combined;
        }
        else if (category === '축제') {
            /* 국문관광정보(축제15) */
            const tourFest = await callTourApi('15', 100);
            if (tourFest && tourFest.length > 0) places = tourFest;
        }
        else if (category === '의료기관') {
            /* 응급의료기관(E-Gen) + 병원정보(심평원) + 카카오맵(HP8) 병렬 호출 */
            const [emergency, hospital, kakaoHosp, keyword] = await Promise.all([
                callEmergencyApi(12),
                callHospitalInfoApi(15),
                callKakaoCategory('HP8', 10),
                callKakaoKeyword('세종 병원 응급', 5),
            ]);
            /* 응급의료기관을 앞쪽에 우선 배치 */
            const combined = [...(emergency||[]), ...(hospital||[]), ...(kakaoHosp||[]), ...(keyword||[])];
            // 이름 기준 중복 제거
            const seen = new Set();
            const deduped = combined.filter(p=>{
                if (seen.has(p.name)) return false;
                seen.add(p.name); return true;
            });
            if (deduped.length > 0) places = deduped;
        }
    } catch(e) {
        console.warn('[getPlaces] 예외:', e.message);
        places = null;
    }

    /* API 실패 또는 키 없음 → 로컬 폴백 */
    if (!places || places.length === 0) {
        places = (LOCAL_FALLBACK[category]||[]).map(p=>({...p, category}));
        if (places.length === 0) {
            console.info(`[폴백] ${category}: 데이터 없음`);
        }
    }

    /* 직선거리 계산 + 가까운 순 1차 정렬 → 즉시 반환(1초 이내 표시가 목표) */
    places = places
        .map(p=>({...p, category, _dist:(p.lat&&p.lng)
            ? haversine(userLoc.lat,userLoc.lng,p.lat,p.lng) : null}))
        .sort((a,b)=>(a._dist===null)-(b._dist===null)||(a._dist||0)-(b._dist||0));

    apiCache[category] = places;

    /* ② 실도로 거리·시간은 백그라운드에서 채움 — 완료되면 보이는 라벨만 갱신하고
       실도로 기준 정렬본을 캐시에 저장(다음 표시부터 반영) */
    fetchDrivingInfo(places).then(() => {
        updateVisibleDriveLabels(places);
        const sortKey = p => p._driveMin!=null ? p._driveMin
                           : p._dist!=null     ? p._dist*3 : Infinity;
        const sorted = [...places].sort((a,b)=>sortKey(a)-sortKey(b));
        apiCache[category] = sorted;
        savePlacesToStorage(category, sorted);
    }).catch(()=>{ savePlacesToStorage(category, places); });

    return places;
}

/* ③ 앱 시작 직후 전 카테고리를 백그라운드로 미리 받아둔다 (main.js에서 호출)
   → 사용자가 탭을 처음 눌러도 메모리 캐시에서 즉시 표시 */
function prefetchPlaces() {
    ['관광명소','먹거리','축제','의료기관'].forEach(c => { getPlaces(c).catch(()=>{}); });
}

/* ── 카드 렌더링 ──────────────────────────────────────────────── */
async function loadUnifiedCategory(categoryKey) {
    document.querySelectorAll('.cat-tab').forEach(b=>b.classList.remove('active'));
    document.getElementById(`tab-${categoryKey}`)?.classList.add('active');
    changeScreen('api-list');

    const box = document.getElementById('dynamic-api-cards-injection-box');
    box.innerHTML = `<div style="text-align:center;padding:48px 0;color:var(--yeoro-muted);">
        <div style="font-size:2em;margin-bottom:8px;">🔍</div>
        <div style="font-size:.85em;font-weight:600;">불러오는 중...</div>
        <div style="font-size:.75em;margin-top:4px;opacity:.7;">API 연동 중이에요</div></div>`;

    const places = await getPlaces(categoryKey);

    if (!places.length) {
        box.innerHTML=`<div style="text-align:center;padding:48px 0;color:var(--yeoro-muted);">
            <div style="font-size:2em;margin-bottom:8px;">📭</div>
            <div style="font-size:.85em;">표시할 장소가 없어요.</div></div>`;
        return;
    }

    renderPlaceCards(places, box);
}

/* 장소 카드 목록 렌더링 (카테고리 화면·검색 결과 공용) */
function renderPlaceCards(places, box) {
    box.innerHTML = '';
    places.forEach(item => {
        const inCart = cart.some(c=>c.id===item.id);
        const dist   = item._driveMin!=null ? `🚗 약 ${item._driveMin}분 (${item._driveKm}km) · `
                     : item._dist!=null     ? `직선거리 ${item._dist}km · ` : '';
        const card   = document.createElement('div');
        card.className = 'place-card';
        card.dataset.pid = item.id;   // 백그라운드 실도로 갱신 시 라벨 찾기용
        card.innerHTML = `
            <div class="place-name">${esc(item.name)}${sourceBadge(item.source||'local')}</div>
            <div class="place-meta">${dist}세종시</div>
            <div class="place-desc">${esc(item.desc||'')}</div>
            ${item.tel?`<div style="font-size:.78em;color:var(--yeoro-muted);margin-bottom:6px;">📞 ${esc(item.tel)}</div>`:''}
            <span class="place-tag">${esc(item.category)}</span>
            ${(item.lat&&item.lng)?`<button class="route-btn" style="background:#FEE500;color:#191919;border:none;border-radius:8px;padding:6px 12px;font-size:.8em;font-weight:700;margin-right:6px;cursor:pointer;">🚗 길찾기</button>`:''}
            <button class="add-btn" ${inCart?'disabled style="opacity:.5"':''}>
                ${inCart?'담김':'추가'}</button>`;
        card.querySelector('.route-btn')?.addEventListener('click', ()=>{
            openKakaoRoute(item.name, item.lat, item.lng);
        });
        card.querySelector('.add-btn').addEventListener('click', e=>{
            if(inCart) return;
            pushToCart(item);
            e.target.disabled=true; e.target.textContent='담김'; e.target.style.opacity='.5';
        });
        box.appendChild(card);
    });
}

/* ── 상단 통합 검색 ──────────────────────────────────────────────
   관광명소·음식점·축제·의료기관을 한 번에 검색한다.
   미리받기(prefetch) 캐시 덕에 대부분 즉시 결과가 나온다. */
const SEARCH_CATEGORIES = ['관광명소','먹거리','축제','의료기관'];

function onSearchInput(value) {
    document.getElementById('search-clear').style.display = value ? 'inline' : 'none';
}
function clearGlobalSearch() {
    const input = document.getElementById('global-search-input');
    if (input) input.value = '';
    document.getElementById('search-clear').style.display = 'none';
    /* 검색 지우면 현재 선택된 카테고리(없으면 관광명소)로 돌아간다 */
    const active = document.querySelector('.cat-tab.active');
    const cat = active ? active.id.replace('tab-','') : '관광명소';
    loadUnifiedCategory(cat);
}

async function runGlobalSearch(query) {
    const q = (query || '').trim();
    if (!q) {
        const active = document.querySelector('.cat-tab.active');
        loadUnifiedCategory(active ? active.id.replace('tab-','') : '관광명소');
        return;
    }

    document.querySelectorAll('.cat-tab').forEach(b=>b.classList.remove('active'));
    changeScreen('api-list');
    const box = document.getElementById('dynamic-api-cards-injection-box');
    box.innerHTML = `<div style="text-align:center;padding:48px 0;color:var(--yeoro-muted);">
        <div style="font-size:2em;margin-bottom:8px;">🔍</div>
        <div style="font-size:.85em;font-weight:600;">"${esc(q)}" 검색 중...</div></div>`;

    /* 전 카테고리 데이터 로딩 (캐시 우선) 후 이름·주소·설명에서 검색 */
    const lists = await Promise.all(SEARCH_CATEGORIES.map(c=>getPlaces(c)));
    const nq = q.toLowerCase();
    const seen = new Set();
    const results = [];
    lists.flat().forEach(p=>{
        const hay = `${p.name||''} ${p.addr||''} ${p.desc||''}`.toLowerCase();
        if (hay.includes(nq) && !seen.has(p.id)) { seen.add(p.id); results.push(p); }
    });
    /* 가까운 순 정렬 */
    const key = p => p._driveMin!=null ? p._driveMin : p._dist!=null ? p._dist*3 : Infinity;
    results.sort((a,b)=>key(a)-key(b));

    if (!results.length) {
        box.innerHTML=`<div style="text-align:center;padding:48px 0;color:var(--yeoro-muted);">
            <div style="font-size:2em;margin-bottom:8px;">🔍</div>
            <div style="font-size:.9em;">"${esc(q)}" 검색 결과가 없어요.</div>
            <div style="font-size:.78em;margin-top:6px;opacity:.7;">다른 이름으로 검색해 보세요.</div></div>`;
        return;
    }
    renderPlaceCards(results, box);   // box를 비우고 카드 채움
    box.insertAdjacentHTML('afterbegin',
        `<div style="font-size:.8em;color:var(--yeoro-muted);margin-bottom:10px;padding:0 2px;">
            "${esc(q)}" 검색 결과 ${results.length}곳</div>`);
}
