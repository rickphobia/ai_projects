plugins {
    alias(libs.plugins.android.application) apply false
    // Declaring the Kotlin plugin here also sets the Kotlin version AGP's built-in Kotlin uses in `app`.
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    // Applied here too so the root build scripts are checked.
    alias(libs.plugins.ktlint)
    alias(libs.plugins.detekt) apply false
}

ktlint {
    version.set(libs.versions.ktlint)
}

tasks.register("lintAll") {
    group = "verification"
    description = "Runs ktlint, detekt and Android lint on every module, and checks core has no Android dependencies " +
        "and calls no Java API the tablet lacks."
    dependsOn(
        ":ktlintCheck",
        ":core:ktlintCheck",
        ":core:detekt",
        ":core:checkNoAndroidDependencies",
        ":core:checkAndroidApis",
        ":app:ktlintCheck",
        ":app:detekt",
        ":app:lintDebug",
    )
}
