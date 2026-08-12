/* ── 날씨 맞춤 코스 추천 ─────────────────────────────────────────
   기상청 실황(callWeatherNow)을 읽어 오늘 날씨에 맞는 일정을 자동 구성한다.
   - 맑음: 야외 명소 위주 + 실내 1곳 + 맛집
   - 비:   실내(박물관·전시·문화시설) 위주로 젖지 않는 코스
   - 눈:   미끄럼 위험 → 이동시간이 가장 짧은 실내 위주로 짜고 경고 안내
   - 폭염/한파: 실내 위주 + 무리하지 않는 동선
   ─────────────────────────────────────────────────────────────────*/

/* 실내 판별은 "장소 이름"으로만 한다.
   분류명(desc)에 키워드를 대면 '역사관'⊂'역사관광지', '체험관'⊂'체험관광지' 같은
   부분일치 충돌로 야외 장소가 실내로 오인된다. desc는 '문화시설'만 신뢰. */
const INDOOR_WORDS  = ['박물관','미술관','도서관','전시','갤러리','아트','공연','영화',
                       '전당','과학관','기념관','역사관','체험관','홍보관','컨벤션',
                       '아쿠아','키즈','온천','스파','시장','쇼핑','실내','센터'];

function isIndoorPlace(p) {
    if ((p.desc || '').includes('문화시설')) return true;      // 관광공사 공식 실내 분류
    return INDOOR_WORDS.some(w => (p.name || '').includes(w));
    /* 그 외(자연·역사·휴양·체험관광지 등)는 야외로 간주 —
       비·눈 오는 날 야외가 실내로 잘못 들어가는 것이 최악이므로 기본값은 야외 */
}

/* ── 날씨 캐시 (5분) — 홈 패널·코스 추천이 재조회 없이 즉시 쓴다 ── */
const WEATHER_TTL = 5 * 60 * 1000;
let _weatherCache = null;
async function getWeatherCached() {
    if (_weatherCache && Date.now() - _weatherCache.ts < WEATHER_TTL) return _weatherCache.data;
    try {
        const saved = JSON.parse(localStorage.getItem('yeoro_weather_v1') || 'null');
        if (saved && Date.now() - saved.ts < WEATHER_TTL) { _weatherCache = saved; return saved.data; }
    } catch(e) {}
    return refreshWeatherNow();
}

/* 캐시를 무시하고 기상청에서 새로 받아온다 (실시간 감시용) */
async function refreshWeatherNow() {
    const data = await callWeatherNow();
    if (data) {
        _weatherCache = { ts: Date.now(), data };
        try { localStorage.setItem('yeoro_weather_v1', JSON.stringify(_weatherCache)); } catch(e) {}
        return data;
    }
    return _weatherCache ? _weatherCache.data : null;   // 실패 시 마지막 값 유지
}

function weatherShortLabel(w) {
    if (!w) return '';
    const icon = w.kind === 'rain' ? '🌧️' : w.kind === 'snow' ? '❄️'
               : (w.temp != null && w.temp >= 33) ? '🥵'
               : (w.temp != null && w.temp <= -10) ? '🥶' : '☀️';
    const desc = w.kind === 'rain' ? '비' : w.kind === 'snow' ? '눈' : '맑음';
    return `${icon} 오늘 세종시 ${w.temp != null ? w.temp + '°C' : ''} ${desc}`;
}

/* 날씨별 배너 테마 — 배경 그라데이션 + 뱃지색을 한 세트로 관리한다.
   badge:[배경, 글자], banner:배너 배경 그라데이션 */
function weatherTheme(w) {
    const mode = weatherModeOf(w) || 'clear';
    /* 배너 글자가 흰색이라 배경은 충분히 진해야 읽힌다.
       날씨마다 색이 달라지는 것은 그대로 두고 톤만 깊게 잡았다. */
    const LIGHT = {
        clear: { text: '#FFFFFF', shadow: 'rgba(0,0,0,.28)', banner: 'linear-gradient(135deg,#2E6AE0 0%,#3F7CEA 48%,#639CF2 100%)' },
        rain:  { text: '#FFFFFF', shadow: 'rgba(0,0,0,.32)', banner: 'linear-gradient(135deg,#3C5A79 0%,#2E4A67 55%,#243B52 100%)' },
        snow:  { text: '#FFFFFF', shadow: 'rgba(0,0,0,.28)', banner: 'linear-gradient(135deg,#5C7CB6 0%,#7597CA 50%,#94B3DD 100%)' },
        heat:  { text: '#FFFFFF', shadow: 'rgba(0,0,0,.28)', banner: 'linear-gradient(135deg,#E2683A 0%,#EE8B3C 55%,#F5A64B 100%)' },
        cold:  { text: '#FFFFFF', shadow: 'rgba(0,0,0,.28)', banner: 'linear-gradient(135deg,#2F5C8F 0%,#3F71A6 50%,#5A8BBD 100%)' },
    };
    /* 어두운 모드 — 같은 날씨 느낌을 유지하되 어둡게, 글자는 밝게 */
    const DARK = {
        clear: { text: '#FFD98A', shadow: 'rgba(0,0,0,.5)', banner: 'linear-gradient(135deg,#16233D 0%,#1E2C48 45%,#3A3320 100%)' },
        rain:  { text: '#BFD8F2', shadow: 'rgba(0,0,0,.5)', banner: 'linear-gradient(135deg,#141E2E 0%,#1B2B40 55%,#22374F 100%)' },
        snow:  { text: '#CBD9F5', shadow: 'rgba(0,0,0,.5)', banner: 'linear-gradient(135deg,#1A2237 0%,#232F4A 50%,#2B3757 100%)' },
        heat:  { text: '#FFC59A', shadow: 'rgba(0,0,0,.5)', banner: 'linear-gradient(135deg,#33210F 0%,#48290F 55%,#5A2E14 100%)' },
        cold:  { text: '#C3DAF2', shadow: 'rgba(0,0,0,.5)', banner: 'linear-gradient(135deg,#14202F 0%,#1C2B3E 50%,#243449 100%)' },
    };
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const set = isDark ? DARK : LIGHT;
    return set[mode] || set.clear;
}

/* 홈 배너 — 로그인 전/게스트/이메일/카카오 어떤 상태에서도 항상 표시되며
   날씨에 맞춰 뱃지색과 배너 배경색이 함께 실시간으로 바뀐다. */
function renderHomeWeatherWith(w) {
    if (!w) return;
    const theme = weatherTheme(w);

    /* 배너 배경색을 날씨에 맞게 변경 (CSS transition으로 부드럽게 전환) */
    const banner = document.querySelector('#screen-main .hero-banner');
    if (banner) banner.style.background = theme.banner;

    /* 배너 위쪽 뱃지에 날씨를 적는다.
       뱃지는 반투명 흰 배경이라 어떤 날씨 색 위에서도 그대로 읽힌다. */
    const line = document.getElementById('home-weather-line');
    if (line) line.textContent = weatherShortLabel(w);
}
async function renderHomeWeather() {
    renderHomeWeatherWith(await getWeatherCached());
}

/* ── 실시간 날씨 감시 ────────────────────────────────────────────
   5분마다(+ 화면으로 돌아올 때마다) 기상청을 다시 조회해 홈 패널을 갱신하고,
   비↔맑음↔눈처럼 날씨가 바뀌면 알림을 띄우고 코스 배너도 새 날씨로 바꾼다. */
let _weatherWatchTimer = null;
let _lastWeatherKind = null;

async function weatherWatchTick(force) {
    const w = force ? await refreshWeatherNow() : await getWeatherCached();
    if (!w) return;
    renderHomeWeatherWith(w);
    if (_lastWeatherKind !== null && _lastWeatherKind !== w.kind) {
        showToast(`${weatherShortLabel(w)} — 날씨가 바뀌었어요! '🌤️ 날씨 맞춤'을 다시 눌러보세요`);
        const banner = document.getElementById('weather-banner');
        if (banner && !banner.classList.contains('hidden')) {
            banner.innerHTML = WEATHER_BANNERS[weatherModeOf(w)](w);
        }
    }
    _lastWeatherKind = w.kind;
}

function startWeatherWatch() {
    if (_weatherWatchTimer) return;
    weatherWatchTick(false);                                        // 즉시 1회 표시
    _weatherWatchTimer = setInterval(() => weatherWatchTick(true), WEATHER_TTL);
    document.addEventListener('visibilitychange', () => {           // 앱으로 돌아오면 바로 갱신
        if (!document.hidden) weatherWatchTick(true);
    });
}

/* 배열에서 무작위로 n개 뽑기 (매번 다른 코스가 나오도록) */
function pickRandom(arr, n) {
    const pool = [...arr];
    const out = [];
    while (pool.length && out.length < n)
        out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
}

/* 이동시간 짧은 순으로 n개 (눈길: 이동 최소화) */
function pickNearest(arr, n) {
    const key = p => p._driveMin != null ? p._driveMin
                   : p._dist != null     ? p._dist * 3 : Infinity;
    return [...arr].sort((a, b) => key(a) - key(b)).slice(0, n);
}

function weatherModeOf(w) {
    if (!w) return null;
    if (w.kind === 'snow') return 'snow';
    if (w.kind === 'rain') return 'rain';
    if (w.temp != null && w.temp >= 33)  return 'heat';
    if (w.temp != null && w.temp <= -10) return 'cold';
    return 'clear';
}

const WEATHER_BANNERS = {
    clear: w => `☀️ 지금 세종시 ${w.temp!=null?w.temp+'°C':''} 맑음 — 야외 명소 위주로 추천해요!`,
    rain:  w => `🌧️ 지금 세종시에 비가 와요 (${w.temp!=null?w.temp+'°C':''}) — 젖지 않는 실내 코스로 짰어요.`,
    snow:  w => `❄️ 눈·미끄럼 주의! — 이동이 가장 짧은 실내 위주 코스예요.<br>
                 <b style="color:#c0392b;">⚠️ 길찾기는 큰길 위주의 자동차 경로를 이용하고, 도보 이동은 최소화하세요.</b>`,
    heat:  w => `🥵 폭염(${w.temp}°C)이에요 — 시원한 실내 위주로 추천해요. 물을 꼭 챙기세요!`,
    cold:  w => `🥶 한파(${w.temp}°C)예요 — 따뜻한 실내 위주로 추천해요.`,
};

/* forceKind: 테스트용 강제 모드('rain'|'snow'|'clear'|'heat'|'cold') — 평소엔 안 씀 */
async function generateWeatherSchedule(forceKind) {
    const box = document.getElementById('schedule-timeline-box');
    const banner = document.getElementById('weather-banner');
    changeScreen('schedule');
    box.innerHTML = `<div style="text-align:center;padding:32px;color:var(--yeoro-muted);">🌤️ 날씨 확인하고 코스 짜는 중...</div>`;
    banner.classList.add('hidden');

    /* 1) 기상청 실황 조회 — 캐시(10분) 덕에 대부분 즉시 (실패 시 맑음 기준 진행) */
    let w = await getWeatherCached();
    let weatherFailed = false;
    if (!w) { weatherFailed = true; w = { temp: null, pty: 0, kind: 'clear' }; }
    if (forceKind) w = { ...w, kind: ['rain','snow'].includes(forceKind) ? forceKind : 'clear',
                         temp: forceKind==='heat' ? 35 : forceKind==='cold' ? -12 : w.temp };
    const mode = weatherModeOf(w);

    /* 2) 장소 풀 로딩 (캐시 덕에 빠름) */
    /* 축제는 기간이 정해져 있어 아무 날에나 갈 수 없으므로 코스에서 제외한다.
       코스에 담긴 장소의 소요시간은 recalculateAndSortRoute에서 계산한다. */
    const [spots, food] = await Promise.all([
        getPlaces('관광명소', { withDrive:false }),
        getPlaces('먹거리',   { withDrive:false }),
    ]);
    const indoor  = spots.filter(isIndoorPlace);
    const outdoor = spots.filter(p => !isIndoorPlace(p));

    /* 3) 날씨별 코스 구성 (맛집은 실내라 모든 날씨에 포함) */
    let course = [];
    if (mode === 'clear') {
        course = [...pickRandom(outdoor, 2), ...pickRandom(indoor, 1), ...pickRandom(food, 1)];
    } else if (mode === 'rain' || mode === 'heat' || mode === 'cold') {
        course = [...pickRandom(indoor, 3), ...pickRandom(food, 1)];
    } else if (mode === 'snow') {
        /* 눈길: 미끄럼 위험 — 이동시간 최소화(가까운 실내만) */
        course = [...pickNearest(indoor, 2), ...pickNearest(food, 1)];
    }
    course = course.filter(Boolean);

    if (!course.length) {
        box.innerHTML = `<p class="text-center py-4 small m-0" style="color:var(--yeoro-muted);">추천할 장소를 찾지 못했어요.</p>`;
        return;
    }

    /* 4) 날씨 배너 표시 + 일정 렌더 */
    banner.innerHTML = (weatherFailed
        ? `🌤️ 날씨 정보를 잠시 불러오지 못해 일반 추천으로 보여드려요.`
        : WEATHER_BANNERS[mode](w));
    banner.classList.remove('hidden');

    cart = course;
    syncCartBadge();
    await recalculateAndSortRoute();

    /* 눈길 모드: 각 일정 항목에도 주의 문구를 붙인다 */
    if (mode === 'snow') {
        document.querySelectorAll('#schedule-timeline-box .timeline-node').forEach(n => {
            const warn = document.createElement('div');
            warn.style.cssText = 'font-size:.72em;color:#c0392b;margin-top:4px;';
            warn.textContent = '⚠️ 눈길 미끄럼 주의 — 자동차 경로 이용 권장';
            n.appendChild(warn);
        });
    }

    showRecommendActions('weather');   // [이대로 여행하기 / 다시 추천] 노출
}
