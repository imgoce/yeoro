/* ── 화면 설정 (글씨 크기 · 글씨체 · 밝은/어두운 모드) ────────────────
   [내 정보] 화면에서 바꾸며, 기기에 저장되어 다음에 열 때도 유지된다.
   여로는 5060 세대와 유아 동반 가족이 주 사용자라 글씨를 크게 키우거나
   읽기 편한 글꼴로 바꾸는 것이 중요한 기능이다.
   ────────────────────────────────────────────────────────────────*/

const PREFS_KEY = 'yeoro_display_prefs';

/* 화면 모드(밝은/어두운)는 기기에 저장하지 않는다.
   앱을 켤 때는 항상 밝은 모드로 시작하고, 어두운 모드는 지금 사용하는 동안만 적용된다.
   (글씨 크기·글씨체는 그대로 저장되어 다음에 켜도 유지된다) */
let _sessionTheme = 'light';

const FONT_STACKS = {
    sans:     "'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
    /* AG 훈민정음체는 유료 글꼴이라 웹에 포함할 수 없어,
       훈민정음 계열의 전통 명조 느낌에 가장 가까운 무료 글꼴(나눔명조)을 쓴다.
       나중에 라이선스를 구입하면 이 한 줄만 바꾸면 된다. */
    myeongjo: "'Nanum Myeongjo', 'Noto Serif KR', serif",
};

function loadPrefs() {
    try {
        const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
        return {
            size:  saved.size  || '115%',
            font:  saved.font  || 'sans',
            theme: _sessionTheme,        // 저장값이 아니라 '지금 세션' 값
            /* 사용자가 글씨체를 직접 골랐는지 — 골랐다면 모드별 기본 글꼴보다 우선한다 */
            fontExplicit: !!saved.fontExplicit,
            /* 글씨 크기를 한 번이라도 직접 정했는지 — 정했다면 로그인할 때마다
               크기 설정 창을 다시 띄우지 않는다 */
            sizeChosen: !!saved.sizeChosen,
        };
    } catch (e) {
        return { size: '115%', font: 'sans', theme: _sessionTheme, fontExplicit: false, sizeChosen: false };
    }
}
function savePrefs(prefs) {
    try {
        /* 화면 모드는 일부러 저장하지 않는다 (켤 때마다 밝은 모드로 시작) */
        const { theme, ...toSave } = prefs;
        localStorage.setItem(PREFS_KEY, JSON.stringify(toSave));
    } catch (e) {}
}

/* ── 실제 적용 ─────────────────────────────────────────────────── */
function applyFontSize(size) {
    const root = document.getElementById('app-root-wrapper');
    if (root) root.style.setProperty('--app-font-size', size);
}
function applyFontStack(fontKey) {
    const root = document.getElementById('app-root-wrapper');
    if (root) root.style.setProperty('--app-font-family',
        FONT_STACKS[fontKey] || FONT_STACKS.sans);
}
function applyTheme(theme) {
    const dark = theme === 'dark';
    /* <html>에 표시해두면 style.css의 어두운 모드 색이 전체에 적용된다 */
    if (dark) document.documentElement.setAttribute('data-theme', 'dark');
    else      document.documentElement.removeAttribute('data-theme');
    /* 일부 브라우저는 최상위 속성만 바뀌면 하위 요소 스타일을 다시 계산하지 않는다.
       화면을 감싸는 요소에도 같은 표시를 달아 확실히 다시 그리게 한다. */
    const wrap = document.getElementById('app-root-wrapper');
    if (wrap) wrap.classList.toggle('theme-dark', dark);
    document.body.classList.toggle('theme-dark', dark);
}

/* 지금 고른 버튼에 표시 */
function markSelected(selector, attr, value) {
    document.querySelectorAll(selector).forEach(btn => {
        const on = btn.dataset[attr] === value;
        btn.style.background = on ? 'var(--yeoro-blue)' : 'var(--yeoro-white)';
        btn.style.color      = on ? '#fff' : 'var(--yeoro-text)';
        btn.style.borderColor = on ? 'var(--yeoro-blue)' : 'var(--yeoro-border)';
    });
}
function refreshPrefButtons() {
    const p = loadPrefs();
    markSelected('.pref-size',  'size',  p.size);
    markSelected('.pref-font',  'font',  p.font);
    markSelected('.pref-theme', 'theme', p.theme);
}

/* ── 사용자가 버튼을 눌렀을 때 ───────────────────────────────────── */
function setPrefFontSize(size) {
    const p = loadPrefs();
    p.size = size;
    p.sizeChosen = true;   // 한 번 정했으면 다음 로그인부터 설정 창을 건너뛴다
    savePrefs(p);
    applyFontSize(size);
    refreshPrefButtons();
}
function setPrefFontFamily(fontKey) {
    const p = loadPrefs();
    p.font = fontKey;
    p.fontExplicit = true;   // 직접 고른 글씨체는 모드별 기본값보다 우선
    savePrefs(p);
    applyFontStack(fontKey);
    refreshPrefButtons();
    if (fontKey === 'myeongjo') showToast('훈민정음 명조체로 바꿨어요');
    else showToast('기본 고딕체로 바꿨어요');
}
function setPrefTheme(theme) {
    _sessionTheme = theme;      // 지금 사용하는 동안만 유지 (저장하지 않음)
    applyTheme(theme);
    refreshPrefButtons();
    /* 날씨 배너는 색을 직접 칠해두므로 테마가 바뀌면 다시 그려준다 */
    if (typeof renderHomeWeather === 'function') renderHomeWeather();
    showToast(theme === 'dark' ? '어두운 모드로 바꿨어요 🌙' : '밝은 모드로 바꿨어요 ☀️');
}

/* 앱을 열 때 — 글씨 크기·글씨체는 저장된 값을 되살리고,
   화면 모드는 항상 밝은 모드로 시작한다. */
function initDisplayPrefs() {
    _sessionTheme = 'light';
    const p = loadPrefs();
    applyFontSize(p.size);
    applyFontStack(p.font);
    applyTheme('light');
    refreshPrefButtons();
}
