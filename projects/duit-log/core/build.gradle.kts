plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.sqldelight)
    alias(libs.plugins.ktlint)
    alias(libs.plugins.detekt)
}

kotlin {
    jvmToolchain(
        libs.versions.jdk
            .get()
            .toInt(),
    )
}

dependencies {
    // api: the generated DuitLogDatabase takes a SqlDriver from the app.
    api(libs.sqldelight.runtime)
    testImplementation(libs.junit)
    testImplementation(libs.sqldelight.sqlite.driver)
}

// The schema and queries (src/main/sqldelight) are checked against the SQLite of the oldest
// phone the app supports; see decision 0004.
sqldelight {
    databases {
        create("DuitLogDatabase") {
            packageName.set("com.rickphobia.duitlog.core.storage")
            dialect(libs.sqldelight.dialect.sqlite318)
        }
    }
}

ktlint {
    version.set(libs.versions.ktlint)
}

// SQLDelight's generated Kotlin is not ours to format. (The ktlint extension's `filter` doesn't
// reach the generated folder, so the check tasks drop it themselves.)
tasks.withType<org.jlleitschuh.gradle.ktlint.tasks.BaseKtLintCheckTask>().configureEach {
    val generated =
        layout.buildDirectory
            .dir("generated")
            .get()
            .asFile
    exclude { it.file.startsWith(generated) }
}

detekt {
    buildUponDefaultConfig = true
    config.setFrom(rootProject.file("config/detekt.yml"))
}

// core holds the rules and is unit-tested on a plain JVM, so it must never need Android.
// This check fails the build if an Android library or an Android import sneaks in.
val checkNoAndroidDependencies =
    tasks.register("checkNoAndroidDependencies") {
        group = "verification"
        description = "Fails if core depends on an Android library or imports an Android package."
        val androidGroupPrefixes = listOf("androidx.", "com.android.", "com.google.android.")
        val androidImport = Regex("""^import\s+(android|androidx)\.""", RegexOption.MULTILINE)
        val modules =
            configurations.compileClasspath.flatMap { classpath ->
                classpath.incoming.artifacts.resolvedArtifacts.map { artifacts ->
                    artifacts.map { it.id.componentIdentifier.displayName }
                }
            }
        val sources = fileTree("src") { include("**/*.kt") }
        inputs.property("modules", modules)
        inputs.files(sources)
        doLast {
            val androidModules =
                modules.get().filter { module ->
                    androidGroupPrefixes.any { module.startsWith(it) } || module.contains("android.jar")
                }
            val androidSources = sources.filter { androidImport.containsMatchIn(it.readText()) }.map { it.path }
            if (androidModules.isNotEmpty() || androidSources.isNotEmpty()) {
                throw GradleException(
                    "core must stay free of Android. Android libraries: $androidModules; " +
                        "files importing android/androidx: $androidSources",
                )
            }
        }
    }

tasks.named("check") { dependsOn(checkNoAndroidDependencies) }
