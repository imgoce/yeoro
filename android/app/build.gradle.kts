import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// 카카오 네이티브 앱 키는 저장소에 커밋하지 않고 local.properties(gitignore 대상)에서 읽는다.
// android/local.properties.example 을 참고해 android/local.properties 를 만들 것.
val localProperties = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
val kakaoNativeAppKey: String = (localProperties.getProperty("KAKAO_NATIVE_APP_KEY") ?: "").also {
    if (it.isEmpty()) logger.warn("KAKAO_NATIVE_APP_KEY가 설정되지 않았습니다 — 카카오 로그인이 동작하지 않습니다. android/local.properties.example 참고.")
}

android {
    namespace = "com.yeoro.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.yeoro.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        buildConfigField("String", "KAKAO_NATIVE_APP_KEY", "\"$kakaoNativeAppKey\"")
        // 카카오 SDK의 계정(브라우저) 로그인 리다이렉트가 사용하는 커스텀 스킴: kakao{NATIVE_APP_KEY}://oauth
        manifestPlaceholders["kakaoNativeAppKey"] = kakaoNativeAppKey
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    buildFeatures {
        buildConfig = true
        viewBinding = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")

    // 카카오 로그인 SDK — loginWithKakaoTalk()은 카카오톡 앱으로, 미설치 시
    // loginWithKakaoAccount()가 자동으로 시스템 브라우저(Custom Tabs)를 열어 로그인한다.
    // WebView 안에서는 절대 카카오 로그인 페이지를 직접 열지 않는다.
    implementation("com.kakao.sdk:v2-user:2.20.6")

    // WebView가 실수로 카카오/기타 OAuth 페이지로 이동하는 경우를 대비한 안전망으로,
    // 해당 URL을 Chrome Custom Tabs로 열기 위한 라이브러리.
    implementation("androidx.browser:browser:1.8.0")
}

// yeoro/frontend 가 원본이다. assets/www는 빌드 시점에 항상 새로 동기화되는
// 산출물이라 커밋하지 않는다(.gitignore 대상) — 두 곳을 따로 수정하다 어긋나는 것을 방지.
val syncWebAssets = tasks.register<Copy>("syncWebAssets") {
    from(rootProject.file("../frontend")) {
        exclude("tools/**")
    }
    into(layout.projectDirectory.dir("src/main/assets/www"))
}

tasks.named("preBuild") {
    dependsOn(syncWebAssets)
}
