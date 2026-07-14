package com.yeoro.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.GeolocationPermissions
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
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

    // 위치 권한을 요청하는 동안 잠시 보관해두는 WebView geolocation 콜백.
    // 사용자가 권한 팝업에서 응답하면 onRequestPermissionsResult에서 이 콜백을 다시 살려준다.
    private var pendingGeolocationOrigin: String? = null
    private var pendingGeolocationCallback: GeolocationPermissions.Callback? = null

    // 만에 하나 웹 콘텐츠 안의 링크가 카카오/OAuth 로그인 페이지로 직접 이동하려 하면
    // WebView 로딩을 막고 Chrome Custom Tabs로 열어주는 안전망.
    private val externalAuthHosts = setOf(
        "kauth.kakao.com",
        "accounts.kakao.com",
        "accounts.google.com",
    )

    private companion object {
        const val REQ_LOCATION = 100
    }

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
            // minSdk 24부터는 String 오버로드가 아니라 이 WebResourceRequest 버전이 호출된다.
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val host = request.url.host ?: return false
                if (host in externalAuthHosts) {
                    openInCustomTabs(request.url.toString())
                    return true
                }
                return false
            }
        }

        // geolocation.js(navigator.geolocation)가 위치를 요청하면 이 콜백이 뜬다.
        // OS 권한이 이미 있으면 바로 허용하고, 없으면 콜백을 보관해둔 채 런타임 권한을
        // 요청한 뒤 onRequestPermissionsResult에서 그 콜백을 다시 살려 허용/거부한다.
        // (권한을 실제로 필요할 때만 물어보므로 첫 실행에서도 위치가 정상 동작한다.)
        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?,
            ) {
                if (origin == null || callback == null) return
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false)
                    return
                }
                pendingGeolocationOrigin = origin
                pendingGeolocationCallback = callback
                ActivityCompat.requestPermissions(
                    this@MainActivity,
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION,
                    ),
                    REQ_LOCATION,
                )
            }

            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                if (BuildConfig.DEBUG) {
                    Log.d("YeoroWebConsole", "${message.message()} (${message.sourceId()}:${message.lineNumber()})")
                }
                return true
            }
        }

        webView.loadUrl("file:///android_asset/www/index.html")
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQ_LOCATION) return

        val granted = grantResults.any { it == PackageManager.PERMISSION_GRANTED }
        val origin = pendingGeolocationOrigin
        val callback = pendingGeolocationCallback
        pendingGeolocationOrigin = null
        pendingGeolocationCallback = null
        if (origin != null && callback != null) {
            callback.invoke(origin, granted, false)
        }
    }

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(
                this, Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    private fun openInCustomTabs(url: String) {
        CustomTabsIntent.Builder().build().launchUrl(this, Uri.parse(url))
    }

    /** KakaoLoginBridge(JS) → 여기로 진입. UI 스레드에서 호출된다. */
    fun startKakaoLogin() {
        // 아직 카카오 앱 키가 없으면(SDK 미초기화) 크래시 대신 안내 메시지를 웹으로 돌려준다.
        if (BuildConfig.KAKAO_NATIVE_APP_KEY.isBlank()) {
            notifyJs(success = false, message = "카카오 로그인이 아직 설정되지 않았습니다")
            return
        }
        if (UserApiClient.instance.isKakaoTalkLoginAvailable(this)) {
            UserApiClient.instance.loginWithKakaoTalk(this) { token, error ->
                if (error != null) {
                    // 사용자가 카카오톡에서 로그인 창을 취소한 경우는 계정 로그인으로 폴백하지 않는다.
                    if (error is ClientError && error.reason == ClientErrorCause.Cancelled) {
                        notifyJs(success = false, message = "카카오 로그인 취소됨")
                    } else {
                        loginWithKakaoAccount()
                    }
                } else if (token != null) {
                    notifyAccessToken(token.accessToken)
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
            } else if (token != null) {
                notifyAccessToken(token.accessToken)
            }
        }
    }

    // 카카오 access token만 JS로 넘기고, 실제 신원 검증(카카오 고유 ID 조회) 및 자체 JWT
    // 발급은 백엔드(/auth/kakao/token)가 담당한다 — 네이티브에서 UserApiClient.me()를
    // 한 번 더 호출할 필요가 없다.
    private fun notifyAccessToken(accessToken: String) {
        val payload = JSONObject().apply { put("accessToken", accessToken) }
        notifyJs(success = true, message = payload.toString())
    }

    private fun notifyJs(success: Boolean, message: String) {
        // 줄바꿈/따옴표가 섞여도 JS 문자열이 깨지지 않도록 모두 이스케이프한다.
        val escaped = message
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
        val js = "window.onNativeKakaoLoginResult($success, '$escaped');"
        runOnUiThread { webView.evaluateJavascript(js, null) }
    }
}
