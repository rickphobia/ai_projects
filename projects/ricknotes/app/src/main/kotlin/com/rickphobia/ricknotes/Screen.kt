package com.rickphobia.ricknotes

import android.net.Uri

/** Which screen is showing. Without a usable Study folder the app only offers the picker. */
internal sealed interface Screen {
    data class PickFolder(
        val problem: String?,
    ) : Screen

    /** Home; with a [sharedImage], tapping a Document places it there. */
    data class Home(
        val studyFolder: String,
        val sharedImage: Uri? = null,
    ) : Screen

    data class Settings(
        val studyFolder: String,
    ) : Screen

    data class PenTest(
        val studyFolder: String,
    ) : Screen

    /** The Revision log of [courseFolder], a path relative to the Study folder. */
    data class RevisionLog(
        val studyFolder: String,
        val courseFolder: String,
    ) : Screen

    data class Review(
        val studyFolder: String,
    ) : Screen

    /** Picking the folder a shared PDF at [uri] is copied into, starting at the tree path [startFolder]. */
    data class ShareFolder(
        val studyFolder: String,
        val uri: Uri,
        val startFolder: String,
    ) : Screen

    /**
     * The Tabs of the Layout, placing a [sharedImage] on the selected one if there is one; Back goes
     * to [backTo], or home when it is null.
     */
    data class Document(
        val studyFolder: String,
        val backTo: Screen? = null,
        val sharedImage: Uri? = null,
    ) : Screen {
        val back: Screen get() = backTo ?: Home(studyFolder)
    }
}
