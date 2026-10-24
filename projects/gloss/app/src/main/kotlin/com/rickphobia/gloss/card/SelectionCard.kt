package com.rickphobia.gloss.card

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.unit.dp
import com.rickphobia.gloss.R
import com.rickphobia.gloss.core.DefineResult
import com.rickphobia.gloss.core.Selection
import com.rickphobia.gloss.core.ai.AiFailure

/**
 * The card at the bottom of the screen: the Selection, then a loading bar, then the answer or a
 * failure with Retry. Tapping outside it, swiping it down or pressing back calls [onClose].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SelectionCard(
    selection: Selection,
    result: DefineResult?,
    onRetry: () -> Unit,
    onOpenKeySettings: () -> Unit,
    onClose: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onClose) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(start = 24.dp, end = 24.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = selection.text,
                style = MaterialTheme.typography.bodyLarge,
                fontStyle = FontStyle.Italic,
            )
            when (result) {
                null -> LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                is DefineResult.Answer -> Text(text = result.text, style = MaterialTheme.typography.bodyLarge)
                is DefineResult.Failed -> FailureMessage(result.failure, onRetry, onOpenKeySettings)
            }
        }
    }
}

@Composable
private fun FailureMessage(
    failure: AiFailure,
    onRetry: () -> Unit,
    onOpenKeySettings: () -> Unit,
) {
    val message =
        when (failure) {
            AiFailure.NoKey -> R.string.card_no_key
            AiFailure.KeyRejected -> R.string.card_key_rejected
            AiFailure.NoInternet -> R.string.card_no_internet
            AiFailure.AiError -> R.string.card_ai_error
        }
    Text(
        text = stringResource(message),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.error,
    )
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(onClick = onRetry) { Text(stringResource(R.string.card_retry)) }
        val keyButton =
            when (failure) {
                AiFailure.NoKey -> R.string.add_key
                AiFailure.KeyRejected -> R.string.change_key
                AiFailure.NoInternet, AiFailure.AiError -> null
            }
        if (keyButton != null) {
            OutlinedButton(onClick = onOpenKeySettings) { Text(stringResource(keyButton)) }
        }
    }
}
