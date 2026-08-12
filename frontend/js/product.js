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

/* ── 화면 열기 ─────────────────────────────────────────────────── */
function openTravelProduct() {
    renderThemeChips();
    setTripType(_tripType);
    changeScreen('product');
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

    /* 코스 순서 — 하루 동선에 맞춘 배치 */
    const plan = _tripType === 'overnight'
        ? ['spot','meal','cafe','spot','spot','cafe']
        : ['spot','meal','cafe','spot'];

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
    document.getElementById('omni-cart-counter-badge').textContent = cart.length;
    document.getElementById('toss-omni-floating-cart').classList.remove('hidden');
    await recalculateAndSortRouteInOrder();   // 취향 코스는 짠 순서를 그대로 유지한다

    /* 어떤 상품인지 안내 배너 */
    const banner = document.getElementById('weather-banner');
    if (banner) {
        const tripName = _tripType === 'overnight' ? '1박 2일' : '당일치기';
        const picked = [...SPOT_THEMES, ...FOOD_THEMES]
            .filter(t => _spotPicks.has(t.key) || _foodPicks.has(t.key))
            .map(t => t.label).join(' · ');
        banner.innerHTML = `✨ <b>${tripName} 맞춤 코스</b>` +
            (picked ? `<br><span style="font-size:.9em;">고른 취향: ${picked}</span>` : '');
        banner.classList.remove('hidden');
    }
    showRecommendActions('product');
}
