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
}
