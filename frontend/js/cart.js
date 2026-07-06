/* ── 장바구니 ─────────────────────────────────────────────────── */
function pushToCart(item) {
    if (cart.some(c=>c.id===item.id)) return;
    cart.push(item);
    document.getElementById('omni-cart-counter-badge').textContent=cart.length;
    document.getElementById('toss-omni-floating-cart').classList.remove('hidden');
}
function removeCartItem(i) {
    cart.splice(i,1);
    document.getElementById('omni-cart-counter-badge').textContent=cart.length;
    if(cart.length===0){
        document.getElementById('toss-omni-floating-cart').classList.add('hidden');
        bootstrap.Modal.getInstance(document.getElementById('omniCartModal'))?.hide();
    } else openOmniCartModal();
}
function openOmniCartModal() {
    const box=document.getElementById('omni-cart-items-list-box');
    box.innerHTML=cart.length===0
        ?`<p class="text-center py-3 m-0 small" style="color:var(--yeoro-muted);">추가한 장소가 없어요.</p>`
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
    new bootstrap.Modal(document.getElementById('omniCartModal')).show();
}
function injectCartToTimelineRoute() {
    bootstrap.Modal.getInstance(document.getElementById('omniCartModal'))?.hide();
    addToTravelLog(cart);          // 일정에 담긴 장소를 여행로그에 자동 기록 (게스트 포함)
    recalculateAndSortRoute();
    changeScreen('schedule');
    showToast('여행로그에 저장됐어요 ✓');
}
