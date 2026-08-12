/* ── 카테고리별 데이터 로딩 ──────────────────────────────────────
   각 카테고리마다 1~2개 API를 호출 → 병합 → 실패 시 폴백
   속도 전략(1초 이내 표시):
   ① localStorage 캐시(10분) → 재방문·재클릭 시 즉시 표시
   ② 실도로 거리(OSRM)는 렌더를 막지 않고 백그라운드에서 채운 뒤 라벨만 갱신
   ③ 앱 시작 직후 prefetchPlaces()가 전 카테고리를 미리 받아둠 → 첫 클릭도 즉시
   ─────────────────────────────────────────────────────────────────*/
const PLACES_CACHE_TTL = 10 * 60 * 1000;   // 10분
/* 목록을 어떻게 만드는지가 바뀌면 이 번호를 올린다.
   올리지 않으면 예전에 저장해 둔 목록(최대 10분)이 그대로 보여서,
   앱을 새로 깔아도 "그대로인데?" 하는 상황이 된다.
   v3 — 관광공사 + 카카오맵 합치기(중복 제거) 적용 */
const PLACES_CACHE_VER = 'v3';

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

/* ── 여러 출처(관광공사 + 카카오맵) 합치기 ────────────────────────
   같은 장소가 두 API에 다 들어 있는 경우가 많다. 그대로 이어붙이면
   목록에 같은 곳이 두 번 나오므로, 아래 기준으로 하나로 합친다.

   같은 곳으로 보는 기준
     ① 이름이 같다 (띄어쓰기·괄호·지점 표기를 뗀 뒤 비교)
     ② 또는 서로 100m 안에 있으면서 한쪽 이름이 다른 쪽에 포함된다
        (예: "고복자연공원" ↔ "고복자연공원 주차장")

   합칠 때는 먼저 들어온 쪽(관광공사)을 남긴다. 무장애 정보·소개글이
   공공데이터에만 있기 때문이다. 대신 그쪽에 없는 항목(전화번호,
   도로명 주소, 카카오맵 링크)은 카카오 쪽 값으로 채워 넣는다.        */
function normalizePlaceName(name) {
    return String(name || '')
        .replace(/\(.*?\)/g, '')            // 괄호 안 설명 제거: 연화사(세종) → 연화사
        .replace(/\s+/g, '')                // 띄어쓰기 제거
        .replace(/(본점|직영점|[가-힣A-Za-z0-9]{1,6}점)$/, '')  // 지점 표기 제거
        .toLowerCase();
}

/* 두 좌표 사이 거리(m). 짧은 거리라 간단한 근사식으로 충분하다. */
function roughDistanceMeters(a, b) {
    if (!a.lat || !a.lng || !b.lat || !b.lng) return Infinity;
    const dLat = (a.lat - b.lat) * 111000;
    const dLng = (a.lng - b.lng) * 88000;   // 위도 36도 부근 보정값
    return Math.sqrt(dLat*dLat + dLng*dLng);
}

function isSamePlace(a, b) {
    const na = normalizePlaceName(a.name), nb = normalizePlaceName(b.name);
    if (!na || !nb) return false;
    if (na === nb) return true;
    const near = roughDistanceMeters(a, b) <= 100;
    return near && (na.includes(nb) || nb.includes(na));
}

/* 비어 있는 항목만 다른 출처의 값으로 채운다 (기존 값은 덮어쓰지 않는다) */
function fillMissingFields(target, extra) {
    ['addr', 'tel', 'placeUrl'].forEach(k => {
        if (!target[k] && extra[k]) target[k] = extra[k];
    });
    if (!target.lat && extra.lat) { target.lat = extra.lat; target.lng = extra.lng; }
    return target;
}

/* 출처 여러 개를 순서대로 합치면서 중복을 없앤다. 앞쪽 목록이 우선. */
function mergePlaceSources(...lists) {
    const merged = [];
    lists.flat().forEach(p => {
        if (!p || !p.name) return;
        const dup = merged.find(m => isSamePlace(m, p));
        if (dup) { fillMissingFields(dup, p); return; }
        merged.push(p);
    });
    return merged;
}

/* ── 프랜차이즈 카페 걸러내기 ──────────────────────────────────────
   여로는 "그 동네에만 있는 곳"을 보여주는 앱이라, 어디에나 있는
   프랜차이즈 카페는 목록에서 뺀다. 판단 근거는 두 가지다.

   ① 카카오 분류에 브랜드가 붙는다
      개인 카페   → "음식점 > 카페"  /  "음식점 > 카페 > 테마카페"
      프랜차이즈  → "음식점 > 카페 > 커피전문점 > 스타벅스"  ← 4단계에 브랜드
   ② 이름이 "○○점"으로 끝난다 — 지점이 여러 개라는 뜻이다
      (예: "텐퍼센트커피 세종시청점")

   ①만으로는 카카오가 브랜드를 안 채운 경우를 놓치므로, 널리 알려진
   브랜드 이름도 함께 본다.                                          */
const FRANCHISE_CAFE_BRANDS = [
    '스타벅스','투썸','이디야','메가커피','메가엠지씨','컴포즈','빽다방','파스쿠찌',
    '할리스','커피빈','탐앤탐스','엔젤리너스','폴바셋','카페베네','매머드','더벤티',
    '커피에반하다','드롭탑','블루보틀','공차','설빙','베스킨','던킨','뚜레쥬르',
    '파리바게뜨','요거프레소','감성커피','더리터','하삼동','매드포갈릭',
];

function isFranchiseCafe(place) {
    const cat  = String(place.desc || '');
    const name = String(place.name || '');
    if (!/카페|커피|디저트|베이커리/.test(cat)) return false;   // 카페가 아니면 대상 아님

    /* ① 카카오 분류 4단계에 브랜드가 붙어 있으면 프랜차이즈 */
    const depth = cat.split('>').length;
    if (depth >= 4) return true;

    /* ② 이름이 지점 표기로 끝나면 체인점 */
    if (/[가-힣A-Za-z0-9]{2,10}점$/.test(name.trim())) return true;

    /* ③ 알려진 브랜드 이름이 들어 있으면 프랜차이즈 */
    const flat = name.replace(/\s/g, '');
    return FRANCHISE_CAFE_BRANDS.some(b => flat.includes(b));
}

/* 화면에 이미 그려진 카드의 거리 라벨을 실도로 값으로 갱신 (재정렬은 하지 않음) */
function updateVisibleDriveLabels(places) {
    places.forEach(p => {
        if (p._driveMin == null) return;
        const meta = document.querySelector(`.place-card[data-pid="${CSS.escape(p.id)}"] .place-meta`);
        if (meta) meta.textContent = `🚗 약 ${p._driveMin}분 (${p._driveKm}km) · 세종시`;
    });
}

async function getPlaces(category, options = {}) {
    /* withDrive: 자동차 소요시간까지 계산할지. 화면에 목록을 보여줄 때만 true.
       (미리받기처럼 화면에 안 쓰는 호출은 false로 두어 API 호출을 아낀다) */
    const withDrive = options.withDrive !== false;

    if (apiCache[category]) {
        if (withDrive) ensureDrivingInfo(category, apiCache[category]);
        return apiCache[category];
    }

    /* ① 저장 캐시 — 소요시간까지 담겨 있으면 즉시 완성형으로 표시 */
    const cached = loadPlacesFromStorage(category);
    if (cached) {
        apiCache[category] = cached;
        if (withDrive) ensureDrivingInfo(category, cached);
        return cached;
    }

    let places = null;

    try {
        if (category === '관광명소') {
            /* 세종시로 분류된 볼거리를 전부 표시:
               관광공사(관광지12 + 문화시설14 + 레포츠28 + 여행코스25 + 웰니스)
               + 카카오맵(AT4 관광명소, CT1 문화시설)
               관광공사에 없는 최신 장소는 카카오맵이 채워준다. */
            const [tour, culture, leports, course, wellness,
                   kakaoSpot, kakaoCulture, barrierFree] = await Promise.all([
                callTourApi('12', 100),
                callTourApi('14', 100),
                callTourApi('28', 100),
                callTourApi('25', 100),
                callWellnessApi(8),
                callKakaoCategory('AT4', 15),
                callKakaoCategory('CT1', 10),
                loadBarrierFreeMap(),      // 휠체어·경사로·엘리베이터 등 무장애 시설 정보
            ]);
            /* 관광공사끼리는 contentid가 같으면 같은 장소다 */
            const seen = new Set();
            const tourAll = [...(tour||[]), ...(culture||[]), ...(leports||[]),
                             ...(course||[]), ...(wellness||[])].filter(p=>{
                if (seen.has(p.id)) return false;
                seen.add(p.id); return true;
            });
            /* 관광공사를 앞에 두고 카카오맵을 뒤에 붙이면서 같은 장소는 하나로 합친다 */
            const deduped = mergePlaceSources(tourAll, kakaoSpot||[], kakaoCulture||[]);
            /* 무장애 정보가 등록된 장소에 시설 정보를 붙인다 (여로의 핵심 정보) */
            deduped.forEach(p => {
                const cid = String(p.id || '').replace(/^tour-/, '');
                if (barrierFree && barrierFree[cid]) p.barrierFree = barrierFree[cid];
            });
            if (deduped.length > 0) places = deduped;
        }
        else if (category === '먹거리') {
            /* 국문관광정보(음식점39) + 카카오맵(FD6 음식점, CE7 카페) 병렬 호출.
               같은 식당이 양쪽에 다 있는 경우가 많아 하나로 합친다. */
            /* 카페는 프랜차이즈를 빼고 나면 수가 확 줄어드니 두 페이지(최대 30곳)를
               받아 두고 거른다. */
            const [tourFood, kakaoFood, cafe1, cafe2] = await Promise.all([
                callTourApi('39', 100),
                callKakaoCategory('FD6', 15),
                callKakaoCategory('CE7', 15, 1),
                callKakaoCategory('CE7', 15, 2),
            ]);
            const localCafes = [...(cafe1||[]), ...(cafe2||[])].filter(p => !isFranchiseCafe(p));
            const combined = mergePlaceSources(tourFood||[], kakaoFood||[], localCafes);
            if (combined.length > 0) places = combined;
        }
        else if (category === '축제') {
            /* 올해 열리는 축제만 보여준다.
               ① 관광공사 축제 API — 행사 기간이 있어 올해 것만 고를 수 있다
               ② 카카오맵 키워드 검색 — 관광공사에 아직 안 올라온 행사를 채운다
                  (이름에 지난 연도가 박힌 것은 뺀다) */
            const [fest, kwFest, kwFestival, kwCulture] = await Promise.all([
                callFestivalApi(),
                callKakaoKeyword('세종 축제', 10),
                callKakaoKeyword('세종 페스티벌', 10),
                callKakaoKeyword('세종 문화제', 10),
            ]);
            /* 축제가 아닌 것(공원 시설물·추진위원회 등)과 지난해 행사를 뺀다 */
            const kakaoThisYear = [...(kwFest||[]), ...(kwFestival||[]), ...(kwCulture||[])]
                .filter(p => isFestivalPlace(p) && isThisYearEvent(p));

            /* 축제 API가 비면 예전 방식(축제15)으로라도 보여준다.
               (관광공사에 올해 축제가 아직 등록되지 않은 시기가 있다) */
            let base = fest;
            if (!base || base.length === 0) {
                base = ((await callTourApi('15', 100)) || []).filter(p => isThisYearEvent(p));
            }
            const combined = mergePlaceSources(base || [], kakaoThisYear);
            if (combined.length > 0) places = combined;
        }
        else if (category === '의료기관') {
            /* 응급의료기관(E-Gen) + 병원정보(심평원) + 카카오맵(HP8) 병렬 호출 */
            const [emergency, hospital, kakaoHosp, keyword] = await Promise.all([
                callEmergencyApi(12),
                callHospitalInfoApi(15),
                callKakaoCategory('HP8', 10),
                callKakaoKeyword('세종 병원 응급', 5),
            ]);
            /* 응급의료기관을 앞쪽에 우선 배치하고, 같은 병원은 하나로 합친다.
               (예: "세종충남대학교병원"과 "세종충남대병원"처럼 표기가 조금씩 다르다) */
            const deduped = mergePlaceSources(emergency||[], hospital||[], kakaoHosp||[], keyword||[]);
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

    /* ② 자동차 소요시간은 백그라운드에서 채운다 (화면 표시를 막지 않음) */
    if (withDrive) ensureDrivingInfo(category, places);
    else savePlacesToStorage(category, places);

    return places;
}

/* 자동차 소요시간·거리를 백그라운드로 채우고, 이미 그려진 라벨만 갱신한다.
   같은 카테고리에 대해 동시에 두 번 돌지 않도록 진행 중 표시를 둔다. */
const _driveInFlight = new Set();
function ensureDrivingInfo(category, places) {
    if (_driveInFlight.has(category)) return;
    /* 좌표가 있는 장소가 모두 이미 계산돼 있으면 다시 부르지 않는다 */
    const pending = places.filter(p => p.lat && p.lng && p._driveMin == null);
    if (!pending.length) return;

    _driveInFlight.add(category);
    fetchDrivingInfo(places).then(() => {
        updateVisibleDriveLabels(places);
        const sortKey = p => p._driveMin!=null ? p._driveMin
                           : p._dist!=null     ? p._dist*3 : Infinity;
        const sorted = [...places].sort((a,b)=>sortKey(a)-sortKey(b));
        apiCache[category] = sorted;
        savePlacesToStorage(category, sorted);
    }).catch(()=>{ savePlacesToStorage(category, places); })
      .finally(()=>{ _driveInFlight.delete(category); });
}

/* ③ 앱 시작 직후 전 카테고리 '목록'만 미리 받아둔다 (main.js에서 호출)
   → 탭을 처음 눌러도 즉시 표시된다.
   소요시간 계산은 화면에 실제로 보여줄 때만 한다. 앱을 켜자마자 4개 카테고리
   전부를 계산하면 길찾기 API에 수백 건이 한꺼번에 몰려 일부가 실패한다. */
function prefetchPlaces() {
    ['관광명소','먹거리','축제','의료기관'].forEach(c => {
        getPlaces(c, { withDrive: false }).catch(()=>{});
    });
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

/* ── 장소 정보 보기 ────────────────────────────────────────────────
   카드의 [정보] 버튼 → 카카오맵에서 찾은 주소·전화·분류를 보여주고,
   더 자세히 보고 싶으면 카카오맵 페이지로 넘어갈 수 있게 한다. */
async function openPlaceInfo(item) {
    const box = document.getElementById('place-info-body');
    if (!box) return;
    box.innerHTML = `
        <div class="page-title" style="font-size:1.1em;margin-bottom:6px;">${esc(item.name)}</div>
        <p class="small m-0" style="color:var(--yeoro-muted);">정보를 불러오는 중...</p>`;
    new bootstrap.Modal(document.getElementById('placeInfoModal')).show();

    const info = await fetchPlaceInfo(item);
    const row = (icon, label, value) => value
        ? `<div style="display:flex;gap:9px;padding:9px 0;border-bottom:1px solid var(--yeoro-border);">
               <span style="flex:none;">${icon}</span>
               <div style="min-width:0;">
                   <div style="font-size:.72em;color:var(--yeoro-muted);">${label}</div>
                   <div style="font-size:.9em;font-weight:600;color:var(--yeoro-text);">${esc(value)}</div>
               </div>
           </div>` : '';

    const addr = (info && info.addr) || item.addr || '';
    const tel  = (info && info.tel)  || item.tel  || '';
    const cat  = (info && info.category) || item.desc || '';
    const bf   = item.barrierFree;

    box.innerHTML = `
        <div class="page-title" style="font-size:1.1em;margin-bottom:4px;">${esc(item.name)}</div>
        <div style="font-size:.78em;color:var(--yeoro-muted);margin-bottom:12px;">${esc(item.category||'')}</div>

        ${row('📍','주소', addr)}
        ${row('📞','전화', tel)}
        ${row('🏷️','분류', cat)}
        ${item._driveMin!=null ? row('🚗','내 위치에서', `약 ${item._driveMin}분 (${item._driveKm}km)`) : ''}

        ${bf ? `<div class="bf-box" style="margin-top:12px;">
            <div class="bf-title">♿ 무장애 시설</div>
            <div class="bf-detail" style="display:block;">${Object.keys(bf).map(k=>{
                const l = BARRIER_FREE_LABELS[k];
                return l ? `<div><b>${l[1]}</b> — ${esc(bf[k])}</div>` : '';
            }).join('')}</div></div>` : ''}

        ${!info ? `<p class="small mt-3 mb-0" style="color:var(--yeoro-muted);">
            카카오맵에서 추가 정보를 찾지 못했어요.</p>` : ''}

        <div style="display:flex;gap:8px;margin-top:16px;">
            ${(info && info.placeUrl) ? `<button class="y-btn-secondary" style="flex:1;margin:0;"
                onclick="openExternal('${esc(info.placeUrl)}')">🗺️ 카카오맵에서 보기</button>` : ''}
            ${(item.lat&&item.lng) ? `<button class="y-btn-primary" style="flex:1;padding:13px;"
                onclick="openKakaoRoute('${esc(item.name).replace(/'/g,'')}',${item.lat},${item.lng})">🚗 길찾기</button>` : ''}
        </div>`;
}

/* 외부 페이지 열기 — 앱에서는 네이티브가 가로채 밖에서 연다 */
/* 카카오맵 등 외부 페이지 열기.
   앱(WebView)에서는 네이티브에 맡겨 브라우저 탭으로만 띄운다 —
   location.href로 넘기면 여로 화면 자체가 그 페이지로 바뀌어버릴 수 있다. */
function openExternal(url) {
    if (window.YeoroNative && typeof window.YeoroNative.openExternalUrl === 'function') {
        window.YeoroNative.openExternalUrl(url);
        return;
    }
    const win = window.open(url, '_blank');
    if (!win) location.href = url;
}

/* 무장애 시설 정보를 칩으로 그린다.
   눌러서 자세한 설명(예: "경사로가 가파른 편…")을 볼 수 있게 한다. */
function barrierFreeChips(item) {
    const bf = item.barrierFree;
    if (!bf) return '';
    const chips = Object.keys(bf).map(k => {
        const label = BARRIER_FREE_LABELS[k];
        if (!label) return '';
        return `<span class="bf-chip" title="${esc(bf[k])}">${label[0]} ${label[1]}</span>`;
    }).join('');
    if (!chips) return '';
    return `<div class="bf-box">
        <div class="bf-title">♿ 무장애 시설</div>
        <div class="bf-chips">${chips}</div>
        <div class="bf-detail">${Object.keys(bf).map(k=>{
            const label = BARRIER_FREE_LABELS[k];
            return label ? `<div><b>${label[1]}</b> — ${esc(bf[k])}</div>` : '';
        }).join('')}</div>
    </div>`;
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
            ${barrierFreeChips(item)}
            <button class="info-btn">ℹ️ 정보</button>
            ${(item.lat&&item.lng)?`<button class="route-btn">🚗 길찾기</button>`:''}
            <button class="add-btn" ${inCart?'disabled style="opacity:.5"':''}>
                ${inCart?'담김':'추가'}</button>`;
        card.querySelector('.route-btn')?.addEventListener('click', ()=>{
            openKakaoRoute(item.name, item.lat, item.lng);
        });
        /* 무장애 칸을 누르면 자세한 설명이 펼쳐진다 */
        card.querySelector('.bf-box')?.addEventListener('click', e=>{
            e.currentTarget.classList.toggle('open');
        });
        card.querySelector('.info-btn')?.addEventListener('click', ()=>openPlaceInfo(item));
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

    /* 전 카테고리 목록만 불러와(소요시간 계산은 생략) 이름·주소·설명에서 검색 */
    const lists = await Promise.all(
        SEARCH_CATEGORIES.map(c=>getPlaces(c, { withDrive:false })));
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

    /* 검색 결과에 대해서만 소요시간을 계산해 라벨을 채운다 */
    fetchDrivingInfo(results).then(()=>updateVisibleDriveLabels(results)).catch(()=>{});
}
