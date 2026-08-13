/* ── 맞춤형 여행상품 ─────────────────────────────────────────────
   좋아하는 장소 유형과 음식 종류를 고르면, 당일치기 또는 1박 2일
   코스를 그 취향에 맞춰 자동으로 짜준다.

   코스 짜는 방식 (사용자가 하루를 보내는 순서에 맞춤)
     당일치기 : 관광지 → 음식점 → 카페 → 관광지          (4곳)
     1박 2일  : 관광지 → 음식점 → 카페 → 관광지 → 관광지 → 카페 (6곳)
   ────────────────────────────────────────────────────────────────*/

/* 관광지 취향 — 관광공사 분류(cat2)와 무장애 정보로 가른다 */
const SPOT_THEMES = [
    { key:'barrierfree', label:'♿ 무장애',   match: p => !!p.barrierFree },
    { key:'park',        label:'🌳 공원·자연', match: p => /공원|수목원|숲|호수|생태|자연|둘레|정원|습지/.test(p.name)
                                                        || /자연관광지|휴양관광지/.test(p.desc||'') },
    { key:'culture',     label:'🎨 문화시설', match: p => /문화시설|박물관|미술관|전시|도서관|공연|전당|센터/.test(`${p.desc||''} ${p.name}`) },
    { key:'history',     label:'🏛️ 역사',     match: p => /역사관광지|유적|사찰|고택|서원|향교|성지/.test(`${p.desc||''} ${p.name}`)
                                                        || /사(?![ا-힣])|암$|묘$|총$/.test(p.name) },
    { key:'experience',  label:'🎪 체험·레포츠', match: p => /체험관광지|레포츠|체험|캠핑|놀이|테마/.test(`${p.desc||''} ${p.name}`) },
];

/* 음식 취향 — 관광공사 음식 분류(cat3)를 이름·설명으로 판별 */
const FOOD_THEMES = [
    { key:'cafe',    label:'☕ 카페·디저트', match: p => /카페|커피|베이커리|제과|디저트|찻집|브런치|roast|coffee/i.test(`${p.name} ${p.desc||''}`) },
    { key:'korean',  label:'🍚 한식',       match: p => /한식|국밥|칼국수|김치|한정식|백반|비빔|찌개|삼겹|갈비|국수|해장|손맛|밥/.test(`${p.name} ${p.desc||''}`) },
    { key:'snack',   label:'🍢 분식',       match: p => /분식|떡볶|김밥|만두|튀김|우동|라면|순대/.test(`${p.name} ${p.desc||''}`) },
    { key:'western', label:'🍝 양식',       match: p => /양식|파스타|피자|스테이크|버거|레스토랑|이탈리|western/i.test(`${p.name} ${p.desc||''}`) },
    { key:'asian',   label:'🍜 중식·일식',  match: p => /중식|일식|짜장|짬뽕|초밥|스시|라멘|우육|돈까스|돈가스|덮밥|회$|횟집/.test(`${p.name} ${p.desc||''}`) },
];

let _tripType = 'day';                 // 'day'(당일치기) | 'overnight'(1박 2일)
let _spotPicks = new Set();            // 고른 관광지 취향
let _foodPicks = new Set();            // 고른 음식 취향
let _courseCount = 4;                  // 코스에 넣을 장소 수 (사용자가 고른다)

/* 고를 수 있는 장소 수 — 기간에 따라 알맞은 범위를 보여준다 */
const COUNT_RANGE = { day: [3,4,5,6], overnight: [5,6,7,8,9,10] };

/* ── 화면 열기 ─────────────────────────────────────────────────── */
function openTravelProduct() {
    renderThemeChips();
    setTripType(_tripType);
    changeScreen('product');
}

/* ── 장소 수 고르기 ────────────────────────────────────────────── */
function renderCountPicker() {
    const box = document.getElementById('prod-count');
    if (!box) return;
    const range = COUNT_RANGE[_tripType];

    /* 기간을 바꾸면 그 기간에 맞는 수로 자동 조정 */
    if (!range.includes(_courseCount)) {
        _courseCount = _tripType === 'overnight' ? 6 : 4;
    }

    box.innerHTML = range.map(n => `
        <button class="count-chip ${n === _courseCount ? 'on' : ''}" data-n="${n}">${n}곳</button>
    `).join('');
    box.querySelectorAll('.count-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            _courseCount = parseInt(btn.dataset.n, 10);
            renderCountPicker();
        });
    });

    /* 어떤 순서로 짜이는지 미리 알려준다 */
    const hint = document.getElementById('prod-count-hint');
    if (hint) {
        const names = { spot:'관광지', meal:'음식점', cafe:'카페' };
        hint.textContent = buildCoursePlan(_courseCount, _tripType).map(s => names[s]).join(' → ');
    }
}

/* 고른 장소 수에 맞춰 코스 순서를 만든다.
   하루를 보내는 흐름을 따른다 — 관광지로 시작해 식사와 카페를 사이에 끼운다.
     3곳  : 관광지 → 음식점 → 관광지
     4곳  : 관광지 → 음식점 → 카페 → 관광지
     6곳  : 관광지 → 음식점 → 카페 → 관광지 → 관광지 → 카페
   1박 2일은 중간에 식사가 한 번 더 들어간다(둘째 날 점심). */
function buildCoursePlan(count, tripType) {
    /* 하루를 보내는 기본 흐름. 필요한 개수만큼 앞에서 잘라 쓴다.
       관광지로 시작 → 식사 → 카페에서 쉬고 → 관광지 두 곳 → 다시 식사… */
    const FLOW = ['spot','meal','cafe','spot','spot','meal','cafe','spot','spot','meal','cafe','spot'];
    const plan = FLOW.slice(0, Math.max(1, Math.min(count, FLOW.length)));

    /* 1박 2일인데 식사가 한 번뿐이면 마지막을 식사로 바꿔 균형을 맞춘다
       (둘째 날 점심이 없는 코스가 되지 않도록) */
    if (tripType === 'overnight' && plan.filter(s => s === 'meal').length < 2 && plan.length >= 5) {
        plan[plan.length - 1] = 'meal';
    }
    return plan;
}

function themeChipHtml(t, picked) {
    return `<button class="theme-chip" data-key="${t.key}"
        style="border:1.5px solid ${picked?'var(--yeoro-blue)':'var(--yeoro-border)'};
               background:${picked?'var(--yeoro-blue)':'var(--yeoro-white)'};
               color:${picked?'#fff':'var(--yeoro-text)'};
               border-radius:12px;padding:9px 13px;font-size:.85em;font-weight:700;cursor:pointer;">
        ${t.label}</button>`;
}

function renderThemeChips() {
    const spotBox = document.getElementById('prod-spot-themes');
    const foodBox = document.getElementById('prod-food-themes');
    if (!spotBox || !foodBox) return;

    spotBox.innerHTML = SPOT_THEMES.map(t => themeChipHtml(t, _spotPicks.has(t.key))).join('');
    foodBox.innerHTML = FOOD_THEMES.map(t => themeChipHtml(t, _foodPicks.has(t.key))).join('');

    spotBox.querySelectorAll('.theme-chip').forEach(btn => {
        btn.addEventListener('click', () => toggleTheme(_spotPicks, btn.dataset.key));
    });
    foodBox.querySelectorAll('.theme-chip').forEach(btn => {
        btn.addEventListener('click', () => toggleTheme(_foodPicks, btn.dataset.key));
    });
}

function toggleTheme(set, key) {
    if (set.has(key)) set.delete(key); else set.add(key);
    renderThemeChips();
}

function setTripType(kind) {
    _tripType = kind;
    document.querySelectorAll('.prod-trip').forEach(btn => {
        const on = btn.dataset.trip === kind;
        btn.style.background  = on ? 'var(--yeoro-blue)' : 'var(--yeoro-white)';
        btn.style.color       = on ? '#fff' : 'var(--yeoro-text)';
        btn.style.borderColor = on ? 'var(--yeoro-blue)' : 'var(--yeoro-border)';
    });
    renderCountPicker();       // 기간에 맞는 장소 수 선택지로 갱신
}

/* ── 코스 만들기 ───────────────────────────────────────────────── */
function pickByThemes(pool, themes, picks) {
    if (!picks.size) return [...pool];                    // 안 고르면 전체에서
    const rules = themes.filter(t => picks.has(t.key));
    const hit = pool.filter(p => rules.some(r => r.match(p)));
    return hit.length ? hit : [...pool];                  // 고른 취향에 맞는 곳이 없으면 전체에서
}

/* 목록에서 중복 없이 n개 뽑기 */
function drawUnique(pool, n, used) {
    const rest = pool.filter(p => !used.has(p.id));
    const out = [];
    while (rest.length && out.length < n) {
        const [picked] = rest.splice(Math.floor(Math.random() * rest.length), 1);
        used.add(picked.id);
        out.push(picked);
    }
    return out;
}

async function generateTravelProduct() {
    const box = document.getElementById('schedule-timeline-box');
    changeScreen('schedule');
    box.innerHTML = `<div style="text-align:center;padding:32px;color:var(--yeoro-muted);">✨ 취향에 맞는 코스를 짜는 중...</div>`;
    hideRecommendActions();

    const [spots, foods] = await Promise.all([
        getPlaces('관광명소', { withDrive:false }),
        getPlaces('먹거리',   { withDrive:false }),
    ]);

    /* 취향으로 후보를 좁힌다 */
    const spotPool = pickByThemes(spots, SPOT_THEMES, _spotPicks);
    const cafeRule = FOOD_THEMES.find(t => t.key === 'cafe');
    const cafePool = foods.filter(p => cafeRule.match(p));
    const mealPool = pickByThemes(
        foods.filter(p => !cafeRule.match(p)),          // 카페가 아닌 식사 장소
        FOOD_THEMES.filter(t => t.key !== 'cafe'),
        new Set([..._foodPicks].filter(k => k !== 'cafe'))
    );

    /* 코스 순서 — 고른 장소 수에 맞춰 하루 동선대로 배치 */
    const plan = buildCoursePlan(_courseCount, _tripType);

    const used = new Set();
    const course = [];
    plan.forEach(slot => {
        const pool = slot === 'spot' ? spotPool : slot === 'cafe' ? cafePool : mealPool;
        const [got] = drawUnique(pool.length ? pool : spots, 1, used);
        if (got) course.push(got);
    });

    if (!course.length) {
        box.innerHTML = `<p class="text-center py-4 small m-0" style="color:var(--yeoro-muted);">추천할 장소를 찾지 못했어요.</p>`;
        return;
    }

    cart = course;
    syncCartBadge();
    await recalculateAndSortRouteInOrder();   // 취향 코스는 짠 순서를 그대로 유지한다

    /* 어떤 상품인지 안내 배너 */
    const banner = document.getElementById('weather-banner');
    if (banner) {
        const tripName = _tripType === 'overnight' ? '1박 2일' : '당일치기';
        const picked = [...SPOT_THEMES, ...FOOD_THEMES]
            .filter(t => _spotPicks.has(t.key) || _foodPicks.has(t.key))
            .map(t => t.label).join(' · ');
        banner.innerHTML = `✨ <b>${tripName} 맞춤 코스 · ${course.length}곳</b>` +
            (picked ? `<br><span style="font-size:.9em;">고른 취향: ${picked}</span>` : '');
        banner.classList.remove('hidden');
    }
    showRecommendActions('product');
}
