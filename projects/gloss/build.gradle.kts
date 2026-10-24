plugins {
    alias(libs.plugins.android.application) apply false
    // Declaring the Kotlin plugin here also sets the Kotlin version AGP's built-in Kotlin uses in `app`.
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.compose) apply false
    // Applied here too so the root build scripts are checked.
    alias(libs.plugins.ktlint)
    alias(libs.plugins.detekt) apply false
    alias(libs.plugins.sqldelight) apply false
}

ktlint {
    version.set(libs.versions.ktlint)
}

tasks.register("lintAll") {
    group = "verification"
    description = "Runs ktlint, detekt and Android lint on every module, and checks core has no Android dependencies."
    dependsOn(
        ":ktlintCheck",
        ":core:ktlintCheck",
        ":core:detekt",
        ":core:checkNoAndroidDependencies",
        ":app:ktlintCheck",
        ":app:detekt",
        ":app:lintDebug",
    )
}

// The one command the README and CI name: every check and every JVM test.
tasks.register("checkAll") {
    group = "verification"
    description = "Runs lintAll and every JVM unit test."
    dependsOn("lintAll", ":core:test", ":app:testDebugUnitTest")
}
