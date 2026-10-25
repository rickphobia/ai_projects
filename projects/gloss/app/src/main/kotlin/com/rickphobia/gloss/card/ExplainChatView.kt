package com.rickphobia.gloss.card

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.rickphobia.gloss.R
import com.rickphobia.gloss.core.ExplainResult

/**
 * An Explain chat under the Selection: the Book context line, the explanation, each follow-up
 * question and answer, then the question being answered (or the failure, with Retry) and the box
 * for the next question.
 */
@Composable
internal fun ExplainChatView(
    state: ExplainCardState,
    question: String,
    onQuestionChange: (String) -> Unit,
    onAsk: () -> Unit,
    onRetry: () -> Unit,
    onOpenKeySettings: () -> Unit,
) {
    val chat = state.chat
    if (chat != null) {
        ContextLine(chat.context)
        Text(text = chat.explanation, style = MaterialTheme.typography.bodyLarge)
        chat.followUps.forEach { followUp ->
            AskedLine(followUp.question)
            Text(text = followUp.answer, style = MaterialTheme.typography.bodyLarge)
        }
    }
    state.asking?.let { AskedLine(it) }
    when (val problem = state.problem) {
        is ExplainResult.Failed -> FailureMessage(problem.failure, onRetry, onOpenKeySettings)
        is ExplainResult.LimitReached -> LimitReachedLine(problem.resetsOn)
        is ExplainResult.Answer, null -> if (state.waiting) LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
    }
    if (state.nearLimit) NearLimitLine()
    if (chat != null && state.problem !is ExplainResult.LimitReached) {
        FollowUpBox(question, enabled = !state.waiting, onQuestionChange, onAsk)
    }
}

/** A question the owner asked, set apart from the answers. */
@Composable
private fun AskedLine(question: String) {
    Text(
        text = question,
        style = MaterialTheme.typography.bodyLarge,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.primary,
    )
}

@Composable
private fun FollowUpBox(
    question: String,
    enabled: Boolean,
    onQuestionChange: (String) -> Unit,
    onAsk: () -> Unit,
) {
    val canAsk = enabled && question.isNotBlank()
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedTextField(
            value = question,
            onValueChange = onQuestionChange,
            modifier = Modifier.weight(1f),
            placeholder = { Text(stringResource(R.string.card_follow_up_hint)) },
            keyboardOptions =
                KeyboardOptions(
                    capitalization = KeyboardCapitalization.Sentences,
                    imeAction = ImeAction.Send,
                ),
            keyboardActions = KeyboardActions(onSend = { if (canAsk) onAsk() }),
        )
        Button(onClick = onAsk, enabled = canAsk) { Text(stringResource(R.string.card_ask)) }
    }
}
