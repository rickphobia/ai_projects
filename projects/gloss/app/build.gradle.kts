plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ktlint)
    alias(libs.plugins.detekt)
}

// The catalog holds the platform as "<major>.<minor>" because that is the SDK package's name.
val (compileSdkMajor, compileSdkMinor) =
    libs.versions.compileSdk
        .get()
        .split(".")
        .map(String::toInt)

// CI passes its run number so every build installs over the last one; a hand-made build is number 1.
val buildNumber =
    providers
        .environmentVariable("GLOSS_BUILD_NUMBER")
        .map(String::toInt)
        .getOrElse(1)

// Set by hand in gradle.properties; CI releases each new one as gloss-v<versionName>.
val appVersionName = providers.gradleProperty("gloss.versionName").get()

// The release key never enters the repo: it is read from these variables (see .env.example).
// Only packaging the release and preview APKs needs them, so lint, tests and debug builds work
// without them.
val releaseSigning =
    listOf(
        "GLOSS_KEYSTORE_FILE",
        "GLOSS_KEYSTORE_PASSWORD",
        "GLOSS_KEY_ALIAS",
        "GLOSS_KEY_PASSWORD",
    ).associateWith { name -> providers.environmentVariable(name).orNull?.takeIf(String::isNotBlank) }
val missingSigningVariables = releaseSigning.filterValues { it == null }.keys.toList()

android {
    namespace = "com.rickphobia.gloss"
    compileSdk {
        version = release(compileSdkMajor) { minorApiLevel = compileSdkMinor }
    }
    buildToolsVersion = libs.versions.buildTools.get()

    defaultConfig {
        applicationId = "com.rickphobia.gloss"
        minSdk =
            libs.versions.minSdk
                .get()
                .toInt()
        targetSdk =
            libs.versions.targetSdk
                .get()
                .toInt()
        versionCode = buildNumber
        // The same version as the release tag (gloss-v<versionName>), so Obtainium can match what
        // is installed.
        versionName = appVersionName
    }

    signingConfigs {
        if (missingSigningVariables.isEmpty()) {
            create("release") {
                storeFile = file(releaseSigning.getValue("GLOSS_KEYSTORE_FILE")!!)
                storePassword = releaseSigning.getValue("GLOSS_KEYSTORE_PASSWORD")
                keyAlias = releaseSigning.getValue("GLOSS_KEY_ALIAS")
                keyPassword = releaseSigning.getValue("GLOSS_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.findByName("release")
        }
        // Pull-request builds: a separate app with its own key, Lookups and Notes, so an unmerged
        // build never touches Gloss's. Its label and menu entries are in src/preview/res.
        create("preview") {
            initWith(getByName("release"))
            applicationIdSuffix = ".preview"
            versionNameSuffix = "-preview.$buildNumber"
        }
    }

    buildFeatures {
        compose = true
    }

    lint {
        warningsAsErrors = true
        abortOnError = true
        // Version bumps are a deliberate change in libs.versions.toml, not something a new
        // release upstream should turn into a red build overnight.
        disable += setOf("GradleDependency", "AndroidGradlePluginVersion", "NewerVersionAvailable", "OldTargetApi")
    }
}

kotlin {
    jvmToolchain(
        libs.versions.jdk
            .get()
            .toInt(),
    )
}

dependencies {
    implementation(project(":core"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.sqldelight.android.driver)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.core)
}

// Without this, a release build with no key would quietly produce an unsigned APK.
val checkReleaseSigning by tasks.registering {
    description = "Fails, naming the missing variables, when the release signing key is not configured."
    val missing = missingSigningVariables
    doLast {
        if (missing.isNotEmpty()) {
            throw GradleException(
                "Release signing is not configured: set ${missing.joinToString()} " +
                    "(see .env.example and the README's \"Signing key\" section).",
            )
        }
    }
}

tasks.matching { it.name == "packageRelease" || it.name == "packagePreview" }.configureEach {
    dependsOn(checkReleaseSigning)
}

ktlint {
    version.set(libs.versions.ktlint)
    android.set(true)
}

detekt {
    buildUponDefaultConfig = true
    config.setFrom(rootProject.file("config/detekt.yml"))
}
