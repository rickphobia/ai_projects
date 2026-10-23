package com.rickphobia.ricknotes.imports

import android.content.Intent
import android.net.Uri
import androidx.core.content.IntentCompat

/**
 * A file another app shared to RickNotes with Share: its [uri] (null if none came with it) and
 * the [type] the other app gave. It is taken once, so going back over the screen doesn't take it again.
 */
class IncomingShare(
    val uri: Uri?,
    val type: String?,
) {
    val kind: ShareKind get() = shareKindOf(type)

    private var taken = false

    /** True the first time only. */
    fun take(): Boolean = !taken.also { taken = true }

    companion object {
        /** The share [intent] carries, or null if it isn't a share. */
        fun from(intent: Intent?): IncomingShare? {
            if (intent?.action != Intent.ACTION_SEND) return null
            val uri = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)
            return IncomingShare(uri, intent.type)
        }
    }
}
