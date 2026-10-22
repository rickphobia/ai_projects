package com.rickphobia.ricknotes.ink

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.core.ink.PagePlacement
import com.rickphobia.ricknotes.core.ink.PagePoint
import com.rickphobia.ricknotes.toolbar.ToolIcon
import kotlin.math.roundToInt

// Far enough from the selection's box that the pen doesn't hit the menu when grabbing the box.
private val MENU_GAP = 12.dp

/** One thing the Lasso menu can do with the selection. */
internal data class LassoAction(
    @DrawableRes val icon: Int,
    val label: String,
    val onClick: () -> Unit,
)

/**
 * The menu of [actions] floating beside the Lasso selection of [ink], while there is one on a page
 * in [placements]. It follows the selection while it is dragged and stays wholly on screen. Put it
 * over the pages, filling the screen.
 */
@Composable
internal fun LassoMenu(
    ink: DocumentInk,
    placements: () -> List<PagePlacement>,
    actions: List<LassoAction>,
) {
    if (ink.lasso.selection == null) return
    Surface(
        shape = MaterialTheme.shapes.medium,
        tonalElevation = 3.dp,
        shadowElevation = 3.dp,
        modifier =
            Modifier.layout { measurable, constraints ->
                val menu = measurable.measure(constraints.copy(minWidth = 0, minHeight = 0))
                layout(constraints.maxWidth, constraints.maxHeight) {
                    // Read while placing, so a drag or scroll moves the menu without recomposing it.
                    val box = ink.lasso.selection?.let { selected -> onScreen(selected, placements()) }
                    if (box != null) {
                        val spot =
                            lassoMenuSpot(
                                box,
                                ScreenSize(menu.width.toFloat(), menu.height.toFloat()),
                                ScreenSize(constraints.maxWidth.toFloat(), constraints.maxHeight.toFloat()),
                                MENU_GAP.toPx(),
                            )
                        menu.place(spot.x.roundToInt(), spot.y.roundToInt())
                    }
                }
            },
    ) {
        Row { actions.forEach { ToolIcon(it.icon, it.label, it.onClick) } }
    }
}

/** Where [selection]'s box is on screen, or null when its page is scrolled out of sight. */
private fun onScreen(
    selection: LassoSelection,
    placements: List<PagePlacement>,
): ScreenBox? {
    val page = placements.firstOrNull { it.pageId == selection.pageId } ?: return null
    val box = selection.box
    val topLeft = page.toScreen(PagePoint(box.left, box.top))
    val bottomRight = page.toScreen(PagePoint(box.right, box.bottom))
    return ScreenBox(topLeft.x, topLeft.y, bottomRight.x, bottomRight.y)
}
