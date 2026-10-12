package com.rickphobia.duitlog.screens

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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

@Composable
fun AppMenu(
    versionName: String,
    buildNumber: Int,
    onShareLog: () -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    val menuLabel = stringResource(R.string.menu)
    Box {
        TextButton(onClick = { open = true }, modifier = Modifier.semantics { contentDescription = menuLabel }) {
            Text("⋮", style = MaterialTheme.typography.titleLarge)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = { Text(stringResource(R.string.share_log)) },
                onClick = {
                    open = false
                    onShareLog()
                },
            )
            DropdownMenuItem(
                text = { Text(stringResource(R.string.version, versionName, buildNumber)) },
                onClick = {},
                enabled = false,
            )
        }
    }
}
