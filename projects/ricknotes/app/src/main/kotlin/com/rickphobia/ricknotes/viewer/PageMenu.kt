package com.rickphobia.ricknotes.viewer

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.ink.PageBackground
import com.rickphobia.ricknotes.core.ink.PageId
import com.rickphobia.ricknotes.ink.DocumentInk
import kotlinx.coroutines.launch

@StringRes
private fun PageBackground.label(): Int =
    when (this) {
        PageBackground.BLANK -> R.string.background_blank
        PageBackground.LINED -> R.string.background_lined
        PageBackground.GRID -> R.string.background_grid
        PageBackground.DOTTED -> R.string.background_dotted
    }

/**
 * The page menu and the page indicator, for the page on screen, [current]. A new Inserted page is
 * scrolled to once it is laid out; a read-only Document has no page menu.
 */
@Composable
internal fun PageControls(
    ink: DocumentInk,
    pages: List<DocumentPage>,
    current: Int,
    listState: LazyListState,
    modifier: Modifier,
) {
    val scope = rememberCoroutineScope()
    var scrollTo by remember { mutableStateOf<PageId?>(null) }
    LaunchedEffect(scrollTo, pages) {
        val index = pages.indexOfFirst { it.id == scrollTo }
        if (index >= 0) {
            listState.scrollToItem(index)
            scrollTo = null
        }
    }
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        pages.getOrNull(current)?.takeIf { !ink.readOnly }?.let { page ->
            PageMenu(page, number = current + 1, ink, onInserted = { scrollTo = it })
        }
        PageNavigator(
            pageIndex = current,
            pageCount = pages.size,
            onJump = { index -> scope.launch { listState.scrollToItem(index) } },
        )
    }
}

/**
 * The page menu for the page on screen, [page], shown as page [number]: Insert page after, with a
 * choice of background, and Remove page on an Inserted page, which asks first if it has ink. The
 * PDF's own pages have no Remove. [onInserted] gets the new page's ID.
 */
@Composable
private fun PageMenu(
    page: DocumentPage,
    number: Int,
    ink: DocumentInk,
    onInserted: (PageId) -> Unit,
    modifier: Modifier = Modifier,
) {
    var open by remember { mutableStateOf(false) }
    var confirming by remember { mutableStateOf<PageId?>(null) }
    Box(modifier = modifier) {
        PageMenuButton(onClick = { open = true })
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            Text(
                stringResource(R.string.insert_page_after, number),
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            )
            PageBackground.entries.forEach { background ->
                DropdownMenuItem(
                    text = { Text(stringResource(background.label())) },
                    onClick = {
                        open = false
                        onInserted(ink.insertPageAfter(page.id, background).id)
                    },
                )
            }
            if (page.inserted) {
                HorizontalDivider()
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.remove_page, number)) },
                    onClick = {
                        open = false
                        if (ink.hasInk(page.id)) confirming = page.id else ink.removePage(page.id)
                    },
                )
            }
        }
    }
    confirming?.let { id ->
        ConfirmRemovePage(
            onRemove = {
                confirming = null
                ink.removePage(id)
            },
            onDismiss = { confirming = null },
        )
    }
}

@Composable
private fun PageMenuButton(onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.inverseSurface.copy(alpha = MENU_BUTTON_ALPHA),
        contentColor = MaterialTheme.colorScheme.inverseOnSurface,
    ) {
        Icon(
            painterResource(R.drawable.ic_more_vert),
            contentDescription = stringResource(R.string.page_menu),
            modifier = Modifier.padding(4.dp),
        )
    }
}

@Composable
private fun ConfirmRemovePage(
    onRemove: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.remove_page_title)) },
        text = { Text(stringResource(R.string.remove_page_text)) },
        confirmButton = { TextButton(onClick = onRemove) { Text(stringResource(R.string.remove)) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) } },
    )
}

// The same see-through dark as the page indicator beside it.
private const val MENU_BUTTON_ALPHA = 0.8f
