package com.yeoro.app

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import com.kakao.sdk.common.model.ClientError
import com.kakao.sdk.common.model.ClientErrorCause
import com.kakao.sdk.user.UserApiClient
import org.json.JSONObject

/**
 * 여로 WebView 호스트 액티비티.
 *
 * 카카오 로그인은 절대 WebView 안에서 직접 열지 않는다 — 카카오/구글 등은 보안상
 * 임베디드 WebView의 User-Agent를 감지해 로그인을 차단한다("disallowed_useragent").
 * 대신 카카오 SDK(UserApiClient)를 통해 카카오톡 앱 또는 시스템 브라우저(Custom Tabs)로
 * 로그인을 진행하고, 결과만 JS로 돌려준다.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    // 만에 하나 웹 콘텐츠 안의 링크가 카카오/OAuth 로그인 페이지로 직접 이동하려 하면
    // WebView 로딩을 막고 Chrome Custom Tabs로 열어주는 안전망.
    private val externalAuthHosts = setOf(
        "kauth.kakao.com",
        "accounts.kakao.com",
        "accounts.google.com",
    )

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = true
        webView.settings.setGeolocationEnabled(true)

        webView.addJavascriptInterface(KakaoLoginBridge(this), "YeoroNative")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                val host = Uri.parse(url).host ?: return false
                if (host in externalAuthHosts) {
                    openInCustomTabs(url)
                    return true
                }
                return false
            }
        }

        webView.loadUrl("file:///android_asset/www/index.html")
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    private fun openInCustomTabs(url: String) {
        CustomTabsIntent.Builder().build().launchUrl(this, Uri.parse(url))
    }

    /** KakaoLoginBridge(JS) → 여기로 진입. UI 스레드에서 호출된다. */
    fun startKakaoLogin() {
        if (UserApiClient.instance.isKakaoTalkLoginAvailable(this)) {
            UserApiClient.instance.loginWithKakaoTalk(this) { token, error ->
                if (error != null) {
                    // 사용자가 카카오톡에서 로그인 창을 취소한 경우는 계정 로그인으로 폴백하지 않는다.
                    if (error is ClientError && error.reason == ClientErrorCause.Cancelled) {
                        notifyJs(success = false, message = "카카오 로그인 취소됨")
                    } else {
                        loginWithKakaoAccount()
                    }
                } else {
                    fetchUserAndNotify()
                }
            }
        } else {
            loginWithKakaoAccount()
        }
    }

    // 카카오톡 미설치 시: SDK가 자동으로 시스템 브라우저(Custom Tabs)를 열어 로그인시키고,
    // AndroidManifest에 등록된 AuthCodeHandlerActivity로 결과를 되돌려준다.
    private fun loginWithKakaoAccount() {
        UserApiClient.instance.loginWithKakaoAccount(this) { token, error ->
            if (error != null) {
                notifyJs(success = false, message = error.message ?: "카카오 로그인 실패")
            } else {
                fetchUserAndNotify()
            }
        }
    }

    private fun fetchUserAndNotify() {
        UserApiClient.instance.me { user, error ->
            if (error != null || user == null) {
                notifyJs(success = false, message = error?.message ?: "사용자 정보 조회 실패")
                return@me
            }
            val payload = JSONObject().apply {
                put("userId", "kakao_${user.id}")
                put("nickname", user.kakaoAccount?.profile?.nickname ?: "카카오 회원")
            }
            notifyJs(success = true, message = payload.toString())
        }
    }

    private fun notifyJs(success: Boolean, message: String) {
        val escaped = message.replace("\\", "\\\\").replace("'", "\\'")
        val js = "window.onNativeKakaoLoginResult(${success}, '${escaped}');"
        runOnUiThread { webView.evaluateJavascript(js, null) }
    }
}
