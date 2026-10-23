plugins {
    alias(libs.plugins.kotlin.jvm)
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
    testImplementation(libs.junit)
}

ktlint {
    version.set(libs.versions.ktlint)
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
