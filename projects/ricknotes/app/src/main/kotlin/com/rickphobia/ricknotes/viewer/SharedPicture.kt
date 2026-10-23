package com.rickphobia.ricknotes.viewer

import android.net.Uri
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.ink.Picture
import com.rickphobia.ricknotes.ink.DocumentInk

/** An image shared to RickNotes, to place on the Document; [chooseAnother] takes it to a different one. */
class SharedImage(
    val uri: Uri,
    val chooseAnother: () -> Unit,
)

/**
 * A [shared] image on its way onto one open Document. It is placed once: not again after "Done",
 * or after it couldn't be. [onPlaced] runs when it is, to pick the Lasso so the pen can move it.
 */
internal class SharedPicture(
    private val shared: SharedImage,
    private val onPlaced: () -> Unit,
) {
    private var tried by mutableStateOf(false)
    private var picture by mutableStateOf<Picture?>(null)

    private val request =
        SharedImagePlacement(shared.uri) { placed ->
            tried = true
            picture = placed
            if (placed != null) onPlaced()
        }

    /** What the page view should place, until it has been tried. */
    val placement: SharedImagePlacement? get() = request.takeUnless { tried }

    /** Says the image was placed, offering to put it on a different Document instead. */
    @Composable
    fun Bar(ink: DocumentInk) {
        val placed = picture ?: return
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(R.string.share_picture_added),
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = {
                ink.lasso.clear()
                ink.deletePicture(placed.id)
                picture = null
                shared.chooseAnother()
            }) { Text(stringResource(R.string.share_different_document)) }
            TextButton(onClick = { picture = null }) { Text(stringResource(R.string.share_done)) }
        }
    }
}
