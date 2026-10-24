package com.rickphobia.ricknotes.panes

import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.layout.Pane

// Long names are cut short so a few Tabs fit side by side.
private val TAB_MAX_WIDTH = 240.dp

// Shows which Tab is being dragged, without hiding its name.
private const val DRAGGED_ALPHA = 0.5f

/**
 * What a Tab does when tapped, closed, or long-pressed and dragged: [dragged] gets where the
 * finger or pen is, in the screen's coordinates, and [dropped] where it let go, or null if the drag
 * was cancelled.
 */
internal class TabActions(
    val select: (Int) -> Unit,
    val close: (Int) -> Unit,
    val dragged: (Int, Offset) -> Unit,
    val dropped: (Int, Offset?) -> Unit,
)

/** The [pane]'s Tabs in a row that scrolls sideways when full, keeping the selected one in view. */
@Composable
internal fun TabBar(
    pane: Pane,
    actions: TabActions,
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
                index = index,
                actions = actions,
            )
        }
    }
}

@Composable
private fun TabChip(
    name: String,
    selected: Boolean,
    index: Int,
    actions: TabActions,
) {
    val colours = MaterialTheme.colorScheme
    val latest by rememberUpdatedState(actions)
    var origin by remember { mutableStateOf(Offset.Zero) }
    var at by remember { mutableStateOf<Offset?>(null) }
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = if (selected) colours.secondaryContainer else colours.surface,
        modifier =
            Modifier
                .padding(end = 4.dp)
                .alpha(if (at != null) DRAGGED_ALPHA else 1f)
                .onGloballyPositioned { origin = it.boundsInRoot().topLeft }
                .pointerInput(index) {
                    detectDragGesturesAfterLongPress(
                        onDragStart = { start -> at = (origin + start).also { latest.dragged(index, it) } },
                        onDragEnd = {
                            latest.dropped(index, at)
                            at = null
                        },
                        onDragCancel = {
                            latest.dropped(index, null)
                            at = null
                        },
                        onDrag = { change, amount ->
                            change.consume()
                            at = at?.plus(amount)?.also { latest.dragged(index, it) }
                        },
                    )
                },
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.clickable(role = Role.Tab, onClick = { actions.select(index) }).padding(start = 12.dp),
        ) {
            Text(
                text = name,
                style = MaterialTheme.typography.titleSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.widthIn(max = TAB_MAX_WIDTH),
            )
            IconButton(onClick = { actions.close(index) }) {
                Icon(
                    painterResource(R.drawable.ic_close),
                    contentDescription = stringResource(R.string.close_tab, name),
                )
            }
        }
    }
}
