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
     * 카카오맵 같은 외부 페이지를 앱 안의 브라우저 탭으로 연다.
     *
     * 웹에서 location.href로 넘기면 주소가 인터셉트 목록에 없을 때 WebView 자체가
     * 그 페이지로 이동해버려 여로 화면이 통째로 사라진다. 그래서 주소를 네이티브로
     * 넘겨 Custom Tabs로만 열고, WebView는 여로 화면 그대로 남겨둔다.
     */
    @JavascriptInterface
    fun openExternalUrl(url: String) {
        activity.runOnUiThread { activity.openExternalUrl(url) }
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
