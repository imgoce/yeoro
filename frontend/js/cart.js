/* ── 장바구니 ─────────────────────────────────────────────────── */

/* 담긴 개수를 하단바 장바구니 아이콘의 숫자에 반영한다.
   담은 곳이 없으면 숫자를 숨긴다 (0이 떠 있으면 지저분해 보인다).
   장바구니 개수가 바뀌는 곳에서는 이 함수만 부르면 된다. */
function syncCartBadge() {
    const count = cart.length;

    const barNum = document.getElementById('omni-cart-counter-badge');
    if (barNum) barNum.textContent = count;

    const badge = document.getElementById('cart-nav-badge');
    if (badge) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.toggle('hidden', count === 0);
    }
    /* 다 비웠으면 안내 바도 즉시 내린다 */
    if (count === 0) hideCartBar();
}

/* "N개의 장소가 담겼어요" 안내 바를 잠깐 띄웠다가 스스로 사라지게 한다.
   계속 떠 있으면 목록의 아래쪽 카드를 가려서, 담은 직후에만 잠깐 보여준다. */
const CART_BAR_MS = 2200;
let _cartBarTimer = null;

function flashCartBar() {
    const bar = document.getElementById('toss-omni-floating-cart');
    if (!bar || !cart.length) return;
    bar.classList.remove('hidden');
    /* 숨김(display:none)에서 막 꺼낸 요소는 위치 계산이 끝나야 전환 효과가 먹는다.
       아래 한 줄이 브라우저에 "지금 한 번 계산해라"라고 시키는 역할이다. */
    void bar.offsetWidth;
    bar.classList.add('show');

    clearTimeout(_cartBarTimer);
    _cartBarTimer = setTimeout(hideCartBar, CART_BAR_MS);
}

function hideCartBar() {
    const bar = document.getElementById('toss-omni-floating-cart');
    if (!bar) return;
    clearTimeout(_cartBarTimer);
    bar.classList.remove('show');
    setTimeout(() => bar.classList.add('hidden'), 260);   // 사라지는 동안 기다렸다가 자리 비움
}

function pushToCart(item) {
    if (cart.some(c=>c.id===item.id)) return;
    cart.push(item);
    syncCartBadge();
    flashCartBar();      // 담았다는 것을 잠깐 알려준다
}
function removeCartItem(i) {
    cart.splice(i,1);
    syncCartBadge();
    /* 모달을 다시 열지 않고 목록만 새로 그린다 (검색 중이던 내용이 사라지지 않도록) */
    renderCartList();
    renderCartAddResults();
}

/* 담긴 장소 목록만 다시 그리기 */
function renderCartList() {
    const box=document.getElementById('omni-cart-items-list-box');
    if (!box) return;
    box.innerHTML=cart.length===0
        ?`<p class="text-center py-3 m-0 small" style="color:var(--yeoro-muted);">아직 담은 장소가 없어요.<br>아래에서 검색하거나 목록에서 골라보세요.</p>`
        :cart.map((item,i)=>`
            <div class="d-flex justify-content-between align-items-center py-2"
                 style="border-bottom:1px solid var(--yeoro-border);">
                <div>
                    <span class="fw-bold" style="color:var(--yeoro-navy);font-size:.93em;">${esc(item.name)}</span>
                    <span class="ms-2" style="font-size:.78em;color:var(--yeoro-muted);">${esc(item.category)}</span>
                </div>
                <span class="material-icons" onclick="removeCartItem(${i})"
                    style="cursor:pointer;font-size:1.15rem;color:var(--yeoro-muted);">close</span>
            </div>`).join('');
}

function openOmniCartModal() {
    renderCartList();
    /* 열 때마다 검색창은 비운 상태로 시작 */
    const input = document.getElementById('cart-add-search');
    if (input) input.value = '';
    _cartSearchHits = [];
    _cartSearchQuery = '';
    renderCartAddResults();
    new bootstrap.Modal(document.getElementById('omniCartModal')).show();
}

/* ── 장바구니 안에서 장소 검색해 바로 담기 ───────────────────────── */
let _cartSearchHits  = [];     // 현재 검색 결과 (id로 찾아 담기 위해 보관)
let _cartSearchQuery = '';     // 현재 검색어 (화면 입력값에 의존하지 않도록 상태로 보관)
let _cartSearchSeq   = 0;      // 늦게 도착한 이전 검색 결과가 덮어쓰지 않도록

async function onCartAddSearch(value) {
    const q = (value || '').trim();
    _cartSearchQuery = q;
    const seq = ++_cartSearchSeq;
    if (!q) { _cartSearchHits = []; renderCartAddResults(); return; }

    const box = document.getElementById('cart-add-results');
    if (box) box.innerHTML =
        `<p class="text-center py-2 m-0 small" style="color:var(--yeoro-muted);">찾는 중...</p>`;

    /* 목록만 불러온다 — 소요시간은 일정에 담은 뒤 계산된다 */
    const lists = await Promise.all(
        SEARCH_CATEGORIES.map(c => getPlaces(c, { withDrive:false })));
    if (seq !== _cartSearchSeq) return;   // 그 사이 검색어가 바뀌었으면 버린다

    const nq = q.toLowerCase();
    const seen = new Set();
    _cartSearchHits = lists.flat().filter(p => {
        if (seen.has(p.id)) return false;
        const hay = `${p.name||''} ${p.addr||''} ${p.desc||''}`.toLowerCase();
        if (!hay.includes(nq)) return false;
        seen.add(p.id); return true;
    }).slice(0, 20);
    renderCartAddResults();
}

function renderCartAddResults() {
    const box = document.getElementById('cart-add-results');
    if (!box) return;
    if (!_cartSearchQuery) { box.innerHTML = ''; return; }
    if (!_cartSearchHits.length) {
        box.innerHTML = `<p class="text-center py-2 m-0 small" style="color:var(--yeoro-muted);">검색 결과가 없어요.</p>`;
        return;
    }
    box.innerHTML = _cartSearchHits.map(p => {
        const inCart = cart.some(c => c.id === p.id);
        return `
        <div class="d-flex justify-content-between align-items-center py-2"
             style="border-bottom:1px solid var(--yeoro-border);">
            <div style="min-width:0;">
                <div class="fw-bold text-truncate" style="color:var(--yeoro-navy);font-size:.9em;">${esc(p.name)}</div>
                <div style="font-size:.75em;color:var(--yeoro-muted);">${esc(p.category)}</div>
            </div>
            <button onclick="addFromCartSearch('${esc(String(p.id)).replace(/'/g,'')}')"
                ${inCart?'disabled':''}
                style="flex:none;border:none;border-radius:9px;padding:6px 13px;font-size:.8em;font-weight:700;
                       background:${inCart?'var(--yeoro-mist)':'var(--yeoro-blue)'};
                       color:${inCart?'var(--yeoro-muted)':'#fff'};cursor:${inCart?'default':'pointer'};">
                ${inCart?'담김':'담기'}</button>
        </div>`;
    }).join('');
}

function addFromCartSearch(id) {
    const place = _cartSearchHits.find(p => String(p.id) === String(id));
    if (!place) return;
    pushToCart(place);
    renderCartList();
    renderCartAddResults();
    showToast(`${place.name} 담았어요 ✓`);
}

/* 카테고리 목록 페이지로 이동해서 고르기 */
function goPickFromCategory(category) {
    bootstrap.Modal.getInstance(document.getElementById('omniCartModal'))?.hide();
    loadUnifiedCategory(category);
}

function injectCartToTimelineRoute() {
    if (!cart.length) { showToast('먼저 장소를 담아주세요', 'error'); return; }
    bootstrap.Modal.getInstance(document.getElementById('omniCartModal'))?.hide();
    addToTravelLog(cart);          // 일정에 담긴 장소를 여행로그에 자동 기록 (게스트 포함)
    hideRecommendActions();        // 직접 만든 일정이므로 추천 확정 버튼은 숨긴다
    recalculateAndSortRoute();
    changeScreen('schedule');
    showToast('여행로그에 저장됐어요 ✓');
}
