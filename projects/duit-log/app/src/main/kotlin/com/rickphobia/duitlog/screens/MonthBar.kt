package com.rickphobia.duitlog.screens

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.rickphobia.duitlog.R
import java.time.YearMonth
import java.time.format.DateTimeFormatter

private val monthTitle = DateTimeFormatter.ofPattern("MMMM yyyy")

/** The Month's name with arrows to the Months either side, and [menu] at the end. */
@Composable
fun MonthBar(
    month: YearMonth,
    onMonthChange: (YearMonth) -> Unit,
    menu: @Composable () -> Unit,
) {
    Surface(color = MaterialTheme.colorScheme.surfaceContainer) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            val previous = stringResource(R.string.previous_month)
            val next = stringResource(R.string.next_month)
            TextButton(
                onClick = { onMonthChange(month.minusMonths(1)) },
                modifier = Modifier.semantics { contentDescription = previous },
            ) { Text("‹", style = MaterialTheme.typography.headlineSmall) }
            Text(
                month.format(monthTitle),
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.weight(1f),
                textAlign = TextAlign.Center,
            )
            TextButton(
                onClick = { onMonthChange(month.plusMonths(1)) },
                modifier = Modifier.semantics { contentDescription = next },
            ) { Text("›", style = MaterialTheme.typography.headlineSmall) }
            menu()
        }
    }
}
