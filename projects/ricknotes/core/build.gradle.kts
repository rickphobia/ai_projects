plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
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
    implementation(libs.kotlinx.serialization.json)
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

// core's tests run on a desktop JDK, which has Java APIs the tablet's Android lacks, and Android lint
// only checks app. So a call like Files.readString (Android API 36.1; the tablet is on 36.0) passes
// every test and crashes on the tablet with NoSuchMethodError, as Send to and opening a Document
// did. This check reads core's compiled classes and fails on any java.* call that Android doesn't
// have at minSdk, using the API levels in the Android SDK's api-versions.xml.
val checkAndroidApis =
    tasks.register("checkAndroidApis") {
        group = "verification"
        description = "Fails if core calls a Java API that Android only has after minSdk."
        val minSdk = libs.versions.minSdk.get()
        val sdkDir =
            providers
                .environmentVariable("ANDROID_HOME")
                .orElse(providers.environmentVariable("ANDROID_SDK_ROOT"))
                .orElse(providers.systemProperty("user.home").map { "$it/Android/Sdk" })
        val compileSdk = libs.versions.compileSdk.get()
        val apiVersions = sdkDir.map { File("$it/platforms/android-$compileSdk/data/api-versions.xml") }
        val javap =
            javaToolchains
                .launcherFor { languageVersion.set(JavaLanguageVersion.of(libs.versions.jdk.get())) }
                .map {
                    it.metadata.installationPath
                        .file("bin/javap")
                        .asFile
                }
        val classes =
            sourceSets.main
                .get()
                .output.classesDirs
        inputs.files(classes)
        inputs.property("minSdk", minSdk)
        inputs.property("apiVersions", apiVersions.map { it.path })
        doLast {
            val apiFile = apiVersions.get()
            if (!apiFile.isFile) {
                throw GradleException(
                    "No $apiFile: install the SDK with scripts/setup-android-sdk.sh, or set ANDROID_HOME.",
                )
            }

            // Android's levels are 36, 36.1 ...; a member without "since" has its class's level.
            class AndroidClass(
                val since: Double,
                val members: MutableMap<String, Double> = mutableMapOf(),
                val parents: MutableList<String> = mutableListOf(),
            )
            val api = mutableMapOf<String, AndroidClass>()
            val reader =
                javax.xml.stream.XMLInputFactory
                    .newInstance()
                    .createXMLStreamReader(apiFile.inputStream())
            var current: AndroidClass? = null
            while (reader.hasNext()) {
                if (reader.next() != javax.xml.stream.XMLStreamConstants.START_ELEMENT) continue
                val name = reader.getAttributeValue(null, "name")
                val since = reader.getAttributeValue(null, "since")?.toDouble()
                when (reader.localName) {
                    "class" -> current = AndroidClass(since ?: 1.0).also { api[name] = it }
                    "method", "field" -> current?.let { it.members[name] = since ?: it.since }
                    "extends", "implements" -> current?.parents?.add(name)
                }
            }

            fun sinceOf(
                owner: String,
                member: String,
                seen: MutableSet<String> = mutableSetOf(),
            ): Double? {
                val androidClass = api[owner]?.takeIf { seen.add(owner) } ?: return null
                return androidClass.members[member]
                    ?: androidClass.parents.firstNotNullOfOrNull { sinceOf(it, member, seen) }
            }

            val classFiles =
                classes.asFileTree
                    .matching { include("**/*.class") }
                    .files
                    .map { it.path }
            val process =
                ProcessBuilder(
                    listOf(javap.get().path, "-c", "-p") + classFiles,
                ).redirectErrorStream(true).start()
            val listing = process.inputStream.bufferedReader().readLines()
            if (process.waitFor() != 0) throw GradleException("javap failed:\n${listing.joinToString("\n")}")

            // javap prints each call as "// Method java/nio/file/Files.readString:(Ljava/nio/file/Path;)...".
            val call = Regex("""// (?:Method|InterfaceMethod|Field) (java/[\w/$]+)\.("?[\w<>$]+"?):(\S+)""")
            val limit = minSdk.toDouble()
            var source = ""
            val problems = sortedSetOf<String>()
            for (line in listing) {
                if (line.startsWith("Compiled from")) source = line.substringAfter('"').substringBefore('"')
                val (owner, name, descriptor) = call.find(line)?.destructured ?: continue
                val member = if (descriptor.startsWith("(")) name.trim('"') + descriptor else name
                val since = sinceOf(owner, member)
                when {
                    owner !in api -> problems += "$source: $owner isn't in Android"
                    since == null -> problems += "$source: $owner.$member isn't in Android"
                    since > limit -> problems += "$source: $owner.$member needs Android API $since"
                }
            }
            if (problems.isNotEmpty()) {
                throw GradleException(
                    "core calls Java APIs the tablet's Android (minSdk $minSdk) doesn't have, " +
                        "so they crash there:\n${problems.joinToString("\n")}",
                )
            }
        }
    }

tasks.named("check") { dependsOn(checkNoAndroidDependencies, checkAndroidApis) }
