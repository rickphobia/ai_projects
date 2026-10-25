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
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.unit.dp
import com.rickphobia.gloss.R
import com.rickphobia.gloss.core.DefineResult
import com.rickphobia.gloss.core.Selection
import com.rickphobia.gloss.core.ai.AiFailure
import com.rickphobia.gloss.core.context.BookContextResult
import com.rickphobia.gloss.core.context.NoBookContextReason
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

/**
 * The card at the bottom of the screen: the Selection, then a loading bar, then the book and
 * chapter the answer used (or why it had none) and the answer, or a failure with Retry. A Define
 * card offers Explain more; an Explain card is a chat with a box for follow-ups. The card is as
 * tall as its content, up to the full screen, and scrolls. Tapping outside it, swiping it down or
 * pressing back calls [onClose].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SelectionCard(
    selection: Selection,
    define: DefineResult?,
    explain: ExplainCardState?,
    question: String,
    onQuestionChange: (String) -> Unit,
    onAsk: () -> Unit,
    onExplainMore: () -> Unit,
    onRetry: () -> Unit,
    onOpenKeySettings: () -> Unit,
    onClose: () -> Unit,
) {
    // No half-open stop: a growing chat pushes the card up to full height instead of hiding below it.
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scroll = rememberScrollState()
    // Keep the newest turn in view as the chat grows.
    LaunchedEffect(explain?.chat?.followUps?.size, explain?.waiting, explain?.problem) {
        if (explain != null) scroll.animateScrollTo(scroll.maxValue)
    }
    ModalBottomSheet(onDismissRequest = onClose, sheetState = sheet) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(scroll)
                    .padding(start = 24.dp, end = 24.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                text = selection.text,
                style = MaterialTheme.typography.bodyLarge,
                fontStyle = FontStyle.Italic,
            )
            if (explain != null) {
                ExplainChatView(explain, question, onQuestionChange, onAsk, onRetry, onOpenKeySettings)
            } else {
                DefineView(define, onExplainMore, onRetry, onOpenKeySettings)
            }
        }
    }
}

@Composable
private fun DefineView(
    result: DefineResult?,
    onExplainMore: () -> Unit,
    onRetry: () -> Unit,
    onOpenKeySettings: () -> Unit,
) {
    when (result) {
        null -> {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        }

        is DefineResult.Answer -> {
            ContextLine(result.context)
            Text(text = result.text, style = MaterialTheme.typography.bodyLarge)
            if (result.nearLimit) NearLimitLine()
            OutlinedButton(onClick = onExplainMore) { Text(stringResource(R.string.card_explain_more)) }
        }

        is DefineResult.Failed -> {
            FailureMessage(result.failure, onRetry, onOpenKeySettings)
        }

        is DefineResult.LimitReached -> {
            LimitReachedLine(result.resetsOn)
        }
    }
}

@Composable
internal fun NearLimitLine() {
    Text(
        text = stringResource(R.string.card_near_limit),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.error,
    )
}

@Composable
internal fun LimitReachedLine(resetsOn: LocalDate) {
    Text(
        text =
            stringResource(
                R.string.card_limit_reached,
                resetsOn.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.LONG)),
            ),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.error,
    )
}

@Composable
internal fun ContextLine(context: BookContextResult) {
    val text =
        when (context) {
            is BookContextResult.Found -> {
                listOf(
                    context.bookContext.book,
                    context.bookContext.chapter,
                ).filter(String::isNotEmpty).joinToString(" · ")
            }

            is BookContextResult.Missing -> {
                stringResource(R.string.card_no_book_context, stringResource(reasonText(context.reason)))
            }
        }
    Text(
        text = text,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

private fun reasonText(reason: NoBookContextReason): Int =
    when (reason) {
        NoBookContextReason.LegadoOff -> R.string.no_context_legado_off
        NoBookContextReason.LegadoSlow -> R.string.no_context_legado_slow
        NoBookContextReason.LegadoCantOpenBook -> R.string.no_context_legado_cant_open_book
        NoBookContextReason.LegadoError -> R.string.no_context_legado_error
        NoBookContextReason.NoBookRead -> R.string.no_context_no_book_read
        NoBookContextReason.NotInChapter -> R.string.no_context_not_in_chapter
    }

@Composable
internal fun FailureMessage(
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
