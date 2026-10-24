package com.rickphobia.gloss.card

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.unit.dp
import com.rickphobia.gloss.core.Selection

/**
 * The card at the bottom of the screen, showing the Selection. Tapping outside it, swiping it
 * down or pressing back calls [onClose].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SelectionCard(
    selection: Selection,
    onClose: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onClose) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(start = 24.dp, end = 24.dp, bottom = 32.dp),
        ) {
            Text(
                text = selection.text,
                style = MaterialTheme.typography.bodyLarge,
                fontStyle = FontStyle.Italic,
            )
        }
    }
}
