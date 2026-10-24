package com.rickphobia.ricknotes.panes

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.layout.Pane

// Long names are cut short so a few Tabs fit side by side.
private val TAB_MAX_WIDTH = 240.dp

/** The [pane]'s Tabs in a row that scrolls sideways when full, keeping the selected one in view. */
@Composable
internal fun TabBar(
    pane: Pane,
    onSelect: (Int) -> Unit,
    onClose: (Int) -> Unit,
) {
    val listState = rememberLazyListState()
    LaunchedEffect(pane.selected, pane.tabs.size) { listState.animateScrollToItem(pane.selected) }
    LazyRow(
        state = listState,
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
    ) {
        itemsIndexed(pane.tabs, key = { _, tab -> tab.path }) { index, tab ->
            TabChip(
                name = tab.path.substringAfterLast('/'),
                selected = index == pane.selected,
                onSelect = { onSelect(index) },
                onClose = { onClose(index) },
            )
        }
    }
}

@Composable
private fun TabChip(
    name: String,
    selected: Boolean,
    onSelect: () -> Unit,
    onClose: () -> Unit,
) {
    val colours = MaterialTheme.colorScheme
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = if (selected) colours.secondaryContainer else colours.surface,
        modifier = Modifier.padding(end = 4.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.clickable(role = Role.Tab, onClick = onSelect).padding(start = 12.dp),
        ) {
            Text(
                text = name,
                style = MaterialTheme.typography.titleSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.widthIn(max = TAB_MAX_WIDTH),
            )
            IconButton(onClick = onClose) {
                Icon(
                    painterResource(R.drawable.ic_close),
                    contentDescription = stringResource(R.string.close_tab, name),
                )
            }
        }
    }
}
