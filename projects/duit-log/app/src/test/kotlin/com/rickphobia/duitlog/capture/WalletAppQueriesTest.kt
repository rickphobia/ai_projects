package com.rickphobia.duitlog.capture

import com.rickphobia.duitlog.core.reader.WalletApps
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

class WalletAppQueriesTest {
    // Gradle runs the app's unit tests from the app module's folder.
    private val manifest = File("src/main/AndroidManifest.xml").readText()

    @Test
    fun `the manifest lets the recorder see exactly the Wallet apps core accepts`() {
        val queried =
            Regex("""<package android:name="([^"]+)"""")
                .findAll(manifest)
                .map { it.groupValues[1] }
                .toSet()

        assertEquals(WalletApps.DEFAULT.packages.keys, queried)
    }
}
