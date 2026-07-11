package com.yeoro.app

import android.app.Application
import android.util.Log
import com.kakao.sdk.common.KakaoSdk

class YeoroApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // 카카오 네이티브 앱 키를 아직 발급받기 전에도 앱은 정상 실행되어야 한다.
        // (키는 앱 변환 후 발급 예정) 키가 비어 있으면 SDK 초기화를 건너뛴다.
        val key = BuildConfig.KAKAO_NATIVE_APP_KEY
        if (key.isNotBlank()) {
            KakaoSdk.init(this, key)
        } else {
            Log.w("Yeoro", "KAKAO_NATIVE_APP_KEY 미설정 — 카카오 로그인 비활성화 상태로 실행합니다.")
        }
    }
}
