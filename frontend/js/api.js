/* ── API 호출 함수들 ───────────────────────────────────────────────
   모든 함수는 실패 시 null/[] 반환 — 절대 예외를 밖으로 던지지 않음
   ─────────────────────────────────────────────────────────────────*/

/* 공통 fetch 래퍼 (타임아웃 + 에러 흡수) */
async function safeFetch(url, options={}) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(()=>controller.abort(), API_CONFIG.HTTP_TIMEOUT);
        const res = await fetch(url, {...options, signal:controller.signal});
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch(e) {
        console.warn(`[API] 실패: ${url.substring(0,60)}... (${e.message})`);
        return null;
    }
}

/* 공공데이터 응답에서 item 배열 안전 추출 */
function extractItems(json) {
    try {
        const items = json?.response?.body?.items?.item;
        if (!items) return [];
        return Array.isArray(items) ? items : [items];
    } catch(e) { return []; }
}

/* 관광공사 분류코드(cat2) → 사람이 읽을 수 있는 이름 */
const TOUR_CAT_LABELS = {
    A0101:'자연관광지', A0102:'관광자원',
    A0201:'역사관광지', A0202:'휴양관광지', A0203:'체험관광지', A0204:'산업관광지',
    A0205:'건축/조형물', A0206:'문화시설', A0207:'축제', A0208:'공연/행사',
    A0301:'레포츠', A0302:'육상레포츠', A0303:'수상레포츠', A0304:'항공레포츠',
    A0401:'쇼핑', A0502:'음식점', B0201:'숙박',
};
function tourCatLabel(it) {
    const code = it.cat2 || (it.cat3||'').slice(0,5);
    return TOUR_CAT_LABELS[code] || '한국관광공사 제공';
}

/* 세종시 대략 경계 — 관광공사 데이터에 좌표가 잘못 등록된 항목이 섞여 있어
   (예: 축제 하나가 수천 km 밖으로 찍힘) 범위를 벗어난 좌표는 버린다.
   좌표가 null이면 거리 표시가 생략되고 길찾기도 막힌다. */
const SEJONG_BOUNDS = { minLat: 36.3, maxLat: 36.8, minLng: 126.95, maxLng: 127.55 };
function sejongCoord(mapy, mapx) {
    const lat = parseFloat(mapy), lng = parseFloat(mapx);
    if (!lat || !lng) return { lat: null, lng: null };
    const inside = lat >= SEJONG_BOUNDS.minLat && lat <= SEJONG_BOUNDS.maxLat
                && lng >= SEJONG_BOUNDS.minLng && lng <= SEJONG_BOUNDS.maxLng;
    if (!inside) {
        console.warn(`[좌표오류] 세종 범위 밖 좌표라 무시합니다: ${lat},${lng}`);
        return { lat: null, lng: null };
    }
    return { lat, lng };
}

/* 관광공사 item 1건 → 여로 표준 장소 객체로 변환 */
function mapTourItem(it) {
    return {
        id:    'tour-'+(it.contentid||it.title),
        name:  (it.title||'').trim(),
        addr:  ((it.addr1||'')+' '+(it.addr2||'')).trim(),
        ...sejongCoord(it.mapy, it.mapx),
        desc:  tourCatLabel(it),
        tel:   it.tel||'',
        image: it.firstimage||it.firstimage2||'',
        source:'tourapi',
    };
}

/* 관광공사 areaBasedList2 한 페이지 호출 (원본 json 반환) */
function tourApiUrl(contentTypeId, rows, pageNo) {
    return 'https://apis.data.go.kr/B551011/KorService2/areaBasedList2?' +
        new URLSearchParams({
            serviceKey:    API_CONFIG.DATA_GO_KR_KEY,
            numOfRows: rows, pageNo,
            MobileOS:'ETC', MobileApp:'Yero', _type:'json',
            areaCode: API_CONFIG.TOUR_AREA_CODE, contentTypeId,
        });
}

/* 국문관광정보 API — contentTypeId: 12=관광지, 14=문화시설, 15=축제, 39=음식점
   세종시(areaCode=8)에 "분류된 전체" 데이터를 가져온다 — 다른 지역은 포함되지 않음.
   totalCount를 읽어 페이지를 끝까지 순회하므로 100건이 넘어도 전부 표시된다.
   거리 계산·가까운 순 정렬은 places.js에서 좌표 기반으로 처리한다. */
async function callTourApi(contentTypeId, rows=100) {
    if (!API_CONFIG.DATA_GO_KR_KEY) return null;

    /* 1페이지를 먼저 받아 전체 개수(totalCount)를 확인한다 */
    const first = await safeFetch(tourApiUrl(contentTypeId, rows, 1));
    if (!first) return null;

    const total = parseInt(first?.response?.body?.totalCount, 10) || 0;
    let items = extractItems(first);

    /* 100건(rows)보다 많으면 남은 페이지를 병렬로 모두 받아 이어붙인다 */
    const lastPage = Math.ceil(total / rows);
    if (lastPage > 1) {
        const rest = [];
        for (let p = 2; p <= lastPage; p++) rest.push(safeFetch(tourApiUrl(contentTypeId, rows, p)));
        const pages = await Promise.all(rest);
        pages.forEach(j => { if (j) items = items.concat(extractItems(j)); });
    }

    console.info(`[관광API] contentType ${contentTypeId}: 세종시 전체 ${total}건 중 ${items.length}건 수신`);
    return items.map(mapTourItem).filter(p=>p.name);
}

/* ── 축제 (한국관광공사 searchFestival2) ─────────────────────────────
   지금까지 쓰던 areaBasedList2(축제15)는 행사 기간을 주지 않아서
   이미 끝난 축제까지 섞여 나왔다 ("2025 세종미술주간 갤러리 가는 날" 등).
   축제 전용 API는 시작·종료일을 함께 주므로 올해 열리는 축제만 고를 수 있다.
   ────────────────────────────────────────────────────────────────*/
function festivalUrl(year, pageNo) {
    return 'https://apis.data.go.kr/B551011/KorService2/searchFestival2?' +
        new URLSearchParams({
            serviceKey: API_CONFIG.DATA_GO_KR_KEY,
            numOfRows: 100, pageNo,
            MobileOS:'ETC', MobileApp:'Yero', _type:'json',
            areaCode: API_CONFIG.TOUR_AREA_CODE,
            eventStartDate: `${year}0101`,   // 올해 안에 열리는 것만
            eventEndDate:   `${year}1231`,
        });
}

/* 20260912 → "2026.09.12" */
function formatEventDate(raw) {
    const s = String(raw || '');
    if (s.length !== 8) return '';
    return `${s.slice(0,4)}.${s.slice(4,6)}.${s.slice(6,8)}`;
}

/* "축제 · 2026.09.12 ~ 09.14" 처럼 기간이 보이는 설명을 만든다 */
function festivalLabel(it) {
    const from = formatEventDate(it.eventstartdate);
    const to   = formatEventDate(it.eventenddate);
    if (!from) return '축제';
    const shortTo = to && to.slice(0,4) === from.slice(0,4) ? to.slice(5) : to;
    return shortTo ? `축제 · ${from} ~ ${shortTo}` : `축제 · ${from}`;
}

async function callFestivalApi(year = new Date().getFullYear()) {
    if (!API_CONFIG.DATA_GO_KR_KEY) return null;

    const first = await safeFetch(festivalUrl(year, 1));
    if (!first) return null;
    const total = parseInt(first?.response?.body?.totalCount, 10) || 0;
    let items = extractItems(first);

    const lastPage = Math.ceil(total / 100);
    if (lastPage > 1) {
        const rest = [];
        for (let p = 2; p <= lastPage; p++) rest.push(safeFetch(festivalUrl(year, p)));
        (await Promise.all(rest)).forEach(j => { if (j) items = items.concat(extractItems(j)); });
    }

    console.info(`[축제API] ${year}년 세종시 축제 ${total}건 수신`);
    return items.map(it => ({
        ...mapTourItem(it),
        desc: festivalLabel(it),
        eventStart: String(it.eventstartdate || ''),
        eventEnd:   String(it.eventenddate   || ''),
    })).filter(p => p.name);
}

/* 이름에 지난 연도가 박혀 있는 행사를 걸러낸다.
   ("2025 세종미술주간"처럼 이름에 연도가 들어 있는 경우)
   ⚠️ Array.filter에 그대로 넘기면 두 번째 인자로 '인덱스'가 들어와
   연도 비교가 망가진다. 반드시 filter(p => isThisYearEvent(p)) 형태로 쓸 것. */
function isThisYearEvent(place, year = new Date().getFullYear()) {
    const m = String(place.name || '').match(/(19|20)\d{2}/);
    if (!m) return true;              // 연도 표기가 없으면 판단 불가 — 남긴다
    return parseInt(m[0], 10) >= year;
}

/* 카카오맵 검색 결과에서 "진짜 축제"만 남긴다.
   "세종 축제"로 검색하면 축제 자체가 아닌 것들이 함께 나온다.
     · 세종호수공원 축제섬, 국립세종수목원 축제마당 → 공원 시설물
     · 조치원복숭아축제추진위원회               → 단체
     · 톳나라 본점                              → 이름만 걸린 음식점       */
function isFestivalPlace(place) {
    const cat  = String(place.desc || '');
    const name = String(place.name || '');
    if (/음식점|카페|단체,협회|공공기관|공원시설물|숙박|학교/.test(cat)) return false;
    if (/이벤트|페스티벌|축제|공연|행사/.test(cat)) return true;
    return /축제|페스티벌|문화제/.test(name);
}

/* 웰니스 관광 API */
/* ── 무장애 여행정보 (한국관광공사 KorWithService2) ──────────────────
   여로의 핵심인 "휠체어·유모차로 갈 수 있는 곳"을 실제 데이터로 확인한다.
   ① 목록(areaBasedList2)으로 세종시 무장애 등록 장소를 받고
   ② 각 장소의 상세(detailWithTour2)에서 시설 정보를 가져온다.
      (경사로·출입구·장애인 화장실·엘리베이터·점자블록·수유실 등)
   ────────────────────────────────────────────────────────────────*/
const BARRIER_FREE_LABELS = {
    wheelchair:   ['♿', '휠체어 대여'],
    parking:      ['🅿️', '장애인 주차'],
    route:        ['🛤️', '접근로'],
    exit:         ['🚪', '출입구'],
    elevator:     ['🛗', '엘리베이터'],
    restroom:     ['🚻', '장애인 화장실'],
    braileblock:  ['⠿', '점자블록'],
    helpdog:      ['🦮', '안내견 동반'],
    lactationroom:['🍼', '수유실'],
    stroller:     ['🚼', '유모차 대여'],
    babysparechair:['🧷', '기저귀 교환대'],
    auditorium:   ['💺', '장애인 관람석'],
    guidehuman:   ['🙋', '안내 도우미'],
    ticketoffice: ['🎫', '매표소 편의'],
    publictransport:['🚌', '대중교통 접근'],
};

/* 무장애 상세 1건 */
async function fetchBarrierFreeDetail(contentId) {
    const url = 'https://apis.data.go.kr/B551011/KorWithService2/detailWithTour2?' +
        new URLSearchParams({
            serviceKey: API_CONFIG.DATA_GO_KR_KEY,
            MobileOS:'ETC', MobileApp:'Yero', _type:'json', contentId,
        });
    const json = await safeFetch(url);
    const items = json?.response?.body?.items;
    if (!items || !items.item) return null;
    const it = Array.isArray(items.item) ? items.item[0] : items.item;
    /* 값이 채워진 항목만 남긴다 (빈 문자열은 '정보 없음') */
    const facts = {};
    Object.keys(BARRIER_FREE_LABELS).forEach(k => {
        const v = (it[k] || '').trim();
        if (v) facts[k] = v;
    });
    return Object.keys(facts).length ? facts : null;
}

/* 세종시 무장애 장소 전체 → { contentId: {시설정보} } */
let _barrierFreeCache = null;
async function loadBarrierFreeMap() {
    if (_barrierFreeCache) return _barrierFreeCache;
    if (!API_CONFIG.DATA_GO_KR_KEY) return {};
    const url = 'https://apis.data.go.kr/B551011/KorWithService2/areaBasedList2?' +
        new URLSearchParams({
            serviceKey: API_CONFIG.DATA_GO_KR_KEY,
            numOfRows: 100, pageNo: 1,
            MobileOS:'ETC', MobileApp:'Yero', _type:'json',
            areaCode: API_CONFIG.TOUR_AREA_CODE,
        });
    const json = await safeFetch(url);
    const list = extractItems(json);
    if (!list.length) return {};

    /* 상세는 장소마다 한 번씩 불러야 해서, 동시 호출 수를 제한한다 */
    const map = {};
    const queue = list.map(it => String(it.contentid));
    let cursor = 0;
    const worker = async () => {
        while (cursor < queue.length) {
            const id = queue[cursor++];
            const facts = await fetchBarrierFreeDetail(id);
            if (facts) map[id] = facts;
        }
    };
    await Promise.all(Array.from({ length: Math.min(5, queue.length) }, worker));
    _barrierFreeCache = map;
    return map;
}

async function callWellnessApi(rows=10) {
    if (!API_CONFIG.DATA_GO_KR_KEY) return null;
    const url = 'https://apis.data.go.kr/B551011/wellnessTourInfo/wellnessList?' +
        new URLSearchParams({
            serviceKey: API_CONFIG.DATA_GO_KR_KEY,
            numOfRows:rows, pageNo:1,
            MobileOS:'ETC', MobileApp:'Yero', _type:'json',
            areaCode: API_CONFIG.TOUR_AREA_CODE,
        });
    const json = await safeFetch(url);
    if (!json) return null;
    return extractItems(json).map(it=>({
        id:    'wellness-'+(it.contentid||it.title),
        name:  (it.title||it.name||'').trim(),
        addr:  (it.addr1||it.address||'').trim(),
        ...sejongCoord(it.mapy||it.latitude, it.mapx||it.longitude),
        desc:  it.overview||it.cat3||'🧘 웰니스 힐링 추천 장소',
        tel:   it.tel||'',
        source:'wellness',
    })).filter(p=>p.name);
}

/* ── 기상청 초단기실황 (세종시 격자 nx=66, ny=103) ────────────────
   PTY(강수형태): 0없음 · 1비 · 2비/눈 · 3눈 · 5빗방울 · 6빗방울눈날림 · 7눈날림
   T1H(기온℃) · RN1(1시간 강수량mm) · WSD(풍속m/s)
   발표가 매시 40분쯤 나오므로 45분 전 시각의 정시 발표분을 조회한다. */
async function callWeatherNow() {
    if (!API_CONFIG.DATA_GO_KR_KEY) return null;
    const t  = new Date(Date.now() - 45 * 60 * 1000);
    const bd = `${t.getFullYear()}${String(t.getMonth()+1).padStart(2,'0')}${String(t.getDate()).padStart(2,'0')}`;
    const bt = String(t.getHours()).padStart(2,'0') + '00';
    const url = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?' +
        new URLSearchParams({
            serviceKey: API_CONFIG.DATA_GO_KR_KEY,
            numOfRows: 10, pageNo: 1, dataType: 'JSON',
            base_date: bd, base_time: bt,
            nx: API_CONFIG.WEATHER_NX, ny: API_CONFIG.WEATHER_NY,
        });
    const json = await safeFetch(url);
    const items = json?.response?.body?.items?.item;
    if (!items || !items.length) return null;
    const val = c => { const it = items.find(i => i.category === c);
                       return it ? parseFloat(it.obsrValue) : null; };
    const pty = val('PTY') ?? 0;
    const kind = [1,5].includes(pty)     ? 'rain'
               : [2,3,6,7].includes(pty) ? 'snow'   // 비/눈·눈날림도 미끄럼 위험으로 취급
               : 'clear';
    return { temp: val('T1H'), rain1h: val('RN1'), wind: val('WSD'), pty, kind };
}

/* ── 자동차 기준 이동시간·거리 ─────────────────────────────────────
   목록에 보여주는 "🚗 약 N분 (Nkm)"은 길찾기 버튼을 눌렀을 때 열리는
   카카오맵 화면의 값과 반드시 같아야 한다. 그래서 계산도 카카오내비
   (모빌리티) 길찾기 API로 한다. 실시간 교통·신호가 반영된 값이다.

   ⚠️ 다중 목적지 API는 간이 계산이라 길찾기 화면과 거리가 미세하게 어긋난다.
      그래서 길찾기 화면이 쓰는 것과 동일한 '단일 길찾기' API를 장소마다 호출한다.
      결과는 10분간 캐시되므로(places.js) 실제 호출은 자주 일어나지 않는다.

   계산 순서
     ① 카카오 단일 길찾기 — 장소마다 호출 (동시 호출 수 제한)
     ② 카카오 키가 없거나 실패하면 OSRM으로 대체 (그것도 실패하면 직선거리 표시)
   ────────────────────────────────────────────────────────────────*/
const KAKAO_NAVI_CONCURRENCY = 4;    // 동시에 보낼 요청 수
const KAKAO_NAVI_MIN_GAP_MS  = 45;   // 요청 사이 최소 간격 — 너무 몰아서 보내면
                                     // 카카오가 "API limit has been exceeded"로 거절한다
const KAKAO_NAVI_RETRY_MS    = 700;  // 거절당했을 때 잠시 쉬었다 재시도하는 간격

/* 요청을 일정 간격으로 흘려보낸다 (초당 호출 제한 대응) */
let _naviNextSlot = 0;
function naviPace() {
    const now = Date.now();
    const slot = Math.max(now, _naviNextSlot);
    _naviNextSlot = slot + KAKAO_NAVI_MIN_GAP_MS;
    const wait = slot - now;
    return wait > 0 ? new Promise(r => setTimeout(r, wait)) : Promise.resolve();
}

function applyDriveSummary(place, meters, seconds) {
    if (meters == null || seconds == null) return;
    place._driveMin = Math.max(1, Math.round(seconds / 60));
    place._driveKm  = Math.round(meters / 100) / 10;
}

/* 카카오 단일 길찾기 — 길찾기 버튼이 여는 카카오맵 화면과 같은 기준으로 계산한다.
   거리 제한이 없어 먼 장소도 그대로 처리된다. */
async function fetchKakaoDriveSingle(place, attempt = 0) {
    const url = 'https://apis-navi.kakaomobility.com/v1/directions?' +
        new URLSearchParams({
            origin: `${userLoc.lng},${userLoc.lat}`,
            destination: `${place.lng},${place.lat}`,
        });
    await naviPace();
    try {
        const res  = await fetch(url, {
            headers: { Authorization: 'KakaoAK ' + API_CONFIG.KAKAO_NAVI_KEY },
        });
        const json = await res.json();

        /* 호출이 몰려 거절당하면(code -10) 잠시 쉬었다 한 번 더 시도 */
        if (json?.code === -10 && attempt < 2) {
            await new Promise(r => setTimeout(r, KAKAO_NAVI_RETRY_MS * (attempt + 1)));
            return fetchKakaoDriveSingle(place, attempt + 1);
        }
        const route = json?.routes?.[0];
        if (route?.result_code === 0 && route.summary) {
            applyDriveSummary(place, route.summary.distance, route.summary.duration);
        }
    } catch (e) {
        /* 네트워크 오류 등 — 값이 없으면 직선거리로 표시된다 */
    }
}

/* 대체 수단: 카카오를 못 쓸 때만 사용 (값이 카카오맵과 다를 수 있음) */
async function fetchDrivingInfoOsrm(places) {
    const CHUNK = 60;   // URL 길이 제한 대비 분할
    for (let i = 0; i < places.length; i += CHUNK) {
        const chunk  = places.slice(i, i + CHUNK);
        const coords = [`${userLoc.lng},${userLoc.lat}`,
                        ...chunk.map(p => `${p.lng},${p.lat}`)].join(';');
        const url = `https://router.project-osrm.org/table/v1/driving/${coords}` +
                    `?sources=0&annotations=duration,distance`;
        const json = await safeFetch(url);
        if (!json || json.code !== 'Ok') return;   // 실패 시 직선거리 폴백 유지
        chunk.forEach((p, idx) => {
            applyDriveSummary(p, json.distances?.[0]?.[idx + 1], json.durations?.[0]?.[idx + 1]);
        });
    }
}

async function fetchDrivingInfo(places) {
    const withCoord = places.filter(p => p.lat && p.lng);
    if (!withCoord.length) return;

    /* 카카오 키가 없으면 대체 수단으로 */
    if (!API_CONFIG.KAKAO_NAVI_KEY) return fetchDrivingInfoOsrm(withCoord);

    /* ① 가까운 곳부터, 동시 호출 수를 제한해가며 개별 조회 */
    const queue = [...withCoord].sort((a, b) => (a._dist ?? Infinity) - (b._dist ?? Infinity));
    let cursor = 0;
    const worker = async () => {
        while (cursor < queue.length) {
            await fetchKakaoDriveSingle(queue[cursor++]);
        }
    };
    await Promise.all(
        Array.from({ length: Math.min(KAKAO_NAVI_CONCURRENCY, queue.length) }, worker));

    /* ② 카카오가 통째로 실패했다면(키 오류·장애) 대체 수단으로 한 번 더 */
    if (!withCoord.some(p => p._driveMin != null)) {
        await fetchDrivingInfoOsrm(withCoord);
    }
}

/* 카카오 로컬 API 공통 헤더.
   브라우저/WebView에서 dapi.kakao.com을 부르면 KA 헤더가 필수다(없으면 401).
   KA 헤더의 origin 값은 카카오 콘솔의 [플랫폼 > Web 사이트 도메인]에 등록돼 있어야 한다. */
function kakaoHeaders() {
    /* 안드로이드 WebView(file://)에서는 location.origin이 유효한 웹 도메인이 아니므로
       카카오 콘솔에 등록된 도메인(KAKAO_WEB_ORIGIN)을 대신 쓴다. */
    const origin = (typeof location !== 'undefined' && /^https?:/.test(location.origin||''))
        ? location.origin
        : (API_CONFIG.KAKAO_WEB_ORIGIN || 'http://localhost:5500');
    return {
        Authorization: 'KakaoAK ' + API_CONFIG.KAKAO_REST_KEY,
        KA: 'sdk/1.0.0 os/javascript lang/ko-KR origin/' + origin,
    };
}

/* 카카오맵 로컬 검색 — 카테고리 코드: FD6=음식점, HP8=병원, AT4=관광명소 */
async function callKakaoCategory(code, size=15, page=1) {
    if (!API_CONFIG.KAKAO_REST_KEY) return null;
    const url = 'https://dapi.kakao.com/v2/local/search/category.json?' +
        new URLSearchParams({
            category_group_code: code,
            x: userLoc.lng, y: userLoc.lat,
            /* 카카오 로컬 API의 최대 반경은 20km (그 이상은 정책상 불가) */
            radius: 20000, size: Math.min(size,15), page, sort:'distance',
        });
    const json = await safeFetch(url, {headers:kakaoHeaders()});
    if (!json) return null;
    return (json.documents||[]).map(d=>({
        id:    'kakao-'+d.id,
        name:  d.place_name||'',
        addr:  d.road_address_name||d.address_name||'',
        lat:   parseFloat(d.y)||null,
        lng:   parseFloat(d.x)||null,
        desc:  d.category_name||'카카오맵 제공',
        tel:   d.phone||'',
        placeUrl: d.place_url||'',   // 카카오맵 상세 페이지
        source:'kakao',
    })).filter(p=>p.name);
}

/* ── 장소 상세 정보 (카카오맵) ─────────────────────────────────────
   카드의 [정보] 버튼에서 쓴다. 관광공사 데이터에는 영업정보·도로명주소가
   없는 경우가 많아, 이름과 좌표로 카카오맵에서 같은 장소를 찾아 채워준다. */
async function fetchPlaceInfo(place) {
    /* 이미 카카오에서 온 장소면 가진 정보를 그대로 쓴다 */
    if (place.source === 'kakao' && place.placeUrl) {
        return { name:place.name, addr:place.addr, tel:place.tel,
                 category:place.desc, placeUrl:place.placeUrl };
    }
    if (!API_CONFIG.KAKAO_REST_KEY) return null;

    const params = { query: place.name, size: 5 };
    if (place.lat && place.lng) {                 // 좌표가 있으면 근처에서 찾아 정확도를 높인다
        params.x = place.lng; params.y = place.lat; params.radius = 5000;
    }
    const url = 'https://dapi.kakao.com/v2/local/search/keyword.json?' + new URLSearchParams(params);
    const json = await safeFetch(url, { headers: kakaoHeaders() });
    const docs = json?.documents || [];
    if (!docs.length) return null;

    /* 이름이 가장 비슷한 것을 고른다 */
    const norm = s => String(s||'').replace(/\s|\(.*?\)/g, '');
    const target = norm(place.name);
    const hit = docs.find(d => norm(d.place_name) === target)
             || docs.find(d => norm(d.place_name).includes(target) || target.includes(norm(d.place_name)))
             || docs[0];
    return {
        name: hit.place_name,
        addr: hit.road_address_name || hit.address_name || '',
        tel:  hit.phone || '',
        category: hit.category_name || '',
        placeUrl: hit.place_url || '',
    };
}

/* XML 응답에서 item 배열 추출 (E-Gen 응급의료 API는 XML만 반환) */
async function safeFetchXmlItems(url) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(()=>controller.abort(), API_CONFIG.HTTP_TIMEOUT);
        const res = await fetch(url, {signal:controller.signal});
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, 'application/xml');
        return Array.from(doc.getElementsByTagName('item')).map(node=>{
            const o = {};
            Array.from(node.children).forEach(c=>{ o[c.tagName] = c.textContent; });
            return o;
        });
    } catch(e) {
        console.warn(`[API] XML 실패: ${url.substring(0,60)}... (${e.message})`);
        return null;
    }
}

/* 응급의료기관 위치기반 조회 (국립중앙의료원 E-Gen) — 현위치 주변 응급의료기관 */
async function callEmergencyApi(rows=12) {
    if (!API_CONFIG.MEDICAL_API_KEY) return null;
    const url = 'https://apis.data.go.kr/B552657/ErmctInfoInqireService/getEgytLcinfoInqire?' +
        new URLSearchParams({
            serviceKey: API_CONFIG.MEDICAL_API_KEY,
            WGS84_LON: userLoc.lng, WGS84_LAT: userLoc.lat,
            pageNo: 1, numOfRows: rows,
        });
    const items = await safeFetchXmlItems(url);
    if (!items) return null;
    return items.map(it=>({
        id:    'egen-'+(it.hpid||it.dutyName),
        name:  (it.dutyName||'').trim(),
        addr:  (it.dutyAddr||'').trim(),
        lat:   parseFloat(it.latitude||it.wgs84Lat)||null,
        lng:   parseFloat(it.longitude||it.wgs84Lon)||null,
        desc:  '🚑 '+(it.dutyEmclsName||it.dutyDivName||'응급의료기관')+(it.distance?` · ${it.distance}km`:''),
        tel:   it.dutyTel1||'',
        source:'egen',
    })).filter(p=>p.name);
}

/* 병원정보서비스 (건강보험심사평가원) — 세종시 병·의원 목록 */
async function callHospitalInfoApi(rows=15) {
    if (!API_CONFIG.MEDICAL_API_KEY) return null;
    const url = 'https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList?' +
        new URLSearchParams({
            serviceKey: API_CONFIG.MEDICAL_API_KEY,
            sidoCd: API_CONFIG.MEDICAL_SIDO_CD,
            pageNo: 1, numOfRows: rows, _type:'json',
        });
    const json = await safeFetch(url);
    if (!json) return null;
    return extractItems(json).map(it=>({
        id:    'hira-'+(it.ykiho||it.yadmNm),
        name:  (it.yadmNm||'').trim(),
        addr:  (it.addr||'').trim(),
        lat:   parseFloat(it.YPos)||null,   // 심평원: YPos=위도, XPos=경도
        lng:   parseFloat(it.XPos)||null,
        desc:  '🏥 '+(it.clCdNm||'병원'),
        tel:   it.telno||'',
        source:'hira',
    })).filter(p=>p.name);
}

/* 카카오 키워드 검색 */
async function callKakaoKeyword(keyword, size=10) {
    if (!API_CONFIG.KAKAO_REST_KEY) return null;
    const url = 'https://dapi.kakao.com/v2/local/search/keyword.json?' +
        new URLSearchParams({query:keyword, x:userLoc.lng, y:userLoc.lat,
            radius:20000, size:Math.min(size,15)});
    const json = await safeFetch(url, {headers:kakaoHeaders()});
    if (!json) return null;
    return (json.documents||[]).map(d=>({
        id:'kakao-kw-'+d.id, name:d.place_name||'',
        addr:d.road_address_name||d.address_name||'',
        lat:parseFloat(d.y)||null, lng:parseFloat(d.x)||null,
        desc:d.category_name||'카카오맵 제공', tel:d.phone||'',
        source:'kakao',
    })).filter(p=>p.name);
}
