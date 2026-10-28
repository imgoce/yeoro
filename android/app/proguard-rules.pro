# WebView JS 브릿지 메서드는 난독화 대상에서 제외 (JS에서 이름으로 호출하기 때문)
-keepclassmembers class com.yeoro.app.KakaoLoginBridge {
    public *;
}
