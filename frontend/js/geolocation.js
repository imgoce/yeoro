/* ── GPS ──────────────────────────────────────────────────────── */
function initGeolocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        p=>{userLoc={lat:p.coords.latitude,lng:p.coords.longitude};},
        ()=>{}, {timeout:5000});
}
