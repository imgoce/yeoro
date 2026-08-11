package com.yeoro.app

import android.webkit.JavascriptInterface

/**
 * WebView(JS) ↔ 네이티브 브릿지.
 * frontend/js/auth.js 에서 `window.YeoroNative.startKakaoLogin()` 형태로 호출한다.
 * 실제 로그인은 MainActivity에서 카카오 SDK로 처리하고, 결과는
 * MainActivity가 evaluateJavascript로 window.onNativeKakaoLoginResult(...)를 호출해 돌려준다.
 */
class KakaoLoginBridge(private val activity: MainActivity) {

    @JavascriptInterface
    fun startKakaoLogin() {
        activity.runOnUiThread { activity.startKakaoLogin() }
    }

    /**
     * 로그아웃 시 카카오 세션까지 끊는다.
     * 이걸 하지 않으면 앱에서 로그아웃해도 카카오 토큰이 기기에 남아,
     * 카카오 버튼을 다시 누르는 순간 아무것도 묻지 않고 곧바로 재로그인된다.
     */
    @JavascriptInterface
    fun logoutKakao() {
        activity.runOnUiThread { activity.logoutKakao() }
    }
}
