import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Where the web app lives. Override per build: ./gradlew assembleRelease -PappUrl=https://app.calitints.com
val appUrl: String = (project.findProperty("appUrl") as String?) ?: "https://cali-tints-demo.vercel.app"
// Optional guest key so a build can open the demo without a login (never for the real deployment).
val demoKey: String = (project.findProperty("demoKey") as String?) ?: ""

// Release signing from keystore.properties (local) or environment variables (CI). Falls back to the debug key.
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun signing(key: String, env: String): String? = keystoreProps.getProperty(key) ?: System.getenv(env)
val releaseStoreFile = signing("storeFile", "ANDROID_KEYSTORE_PATH")

android {
    namespace = "com.calitints.clover"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.calitints.clover"
        minSdk = 24
        // Clover asks apps to target API 25; its devices run Android 7 to 10.
        targetSdk = 25
        versionCode = (project.findProperty("versionCode") as String?)?.toInt() ?: 1
        versionName = (project.findProperty("versionName") as String?) ?: "1.0.0"
        buildConfigField("String", "APP_URL", "\"$appUrl\"")
        buildConfigField("String", "DEMO_KEY", "\"$demoKey\"")
    }

    signingConfigs {
        if (releaseStoreFile != null) {
            create("release") {
                storeFile = file(releaseStoreFile)
                storePassword = signing("storePassword", "ANDROID_KEYSTORE_PASSWORD")
                keyAlias = signing("keyAlias", "ANDROID_KEY_ALIAS")
                keyPassword = signing("keyPassword", "ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = if (releaseStoreFile != null) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    buildFeatures {
        buildConfig = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    lint {
        // The Clover SDK targets API 25 by design; keep lint from failing the build over it.
        disable += setOf("ExpiredTargetSdkVersion", "OldTargetApi")
        abortOnError = false
    }
    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    implementation("com.clover.sdk:clover-android-sdk:341")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.core:core-ktx:1.15.0")
    testImplementation("junit:junit:4.13.2")
}
