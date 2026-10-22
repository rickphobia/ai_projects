package com.rickphobia.ricknotes.toolbar

import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.PlainTooltip
import androidx.compose.material3.Text
import androidx.compose.material3.TooltipAnchorPosition
import androidx.compose.material3.TooltipBox
import androidx.compose.material3.TooltipDefaults
import androidx.compose.material3.rememberTooltipState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

private val INK_MARK_WIDTH = 16.dp
private val INK_MARK_HEIGHT = 4.dp

/**
 * One toolbar icon, greyed out while [onClick] is null. [label] shows on long-press and is what
 * TalkBack reads. A [selected] tool sits on a filled circle; [inkMark] draws a bar of that colour
 * under the icon, so a pen shows its ink in light and dark themes alike.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ToolIcon(
    @DrawableRes icon: Int,
    label: String,
    onClick: (() -> Unit)?,
    selected: Boolean = false,
    inkMark: Color? = null,
) {
    TooltipBox(
        positionProvider = TooltipDefaults.rememberTooltipPositionProvider(TooltipAnchorPosition.Below),
        tooltip = { PlainTooltip { Text(label) } },
        state = rememberTooltipState(),
    ) {
        IconButton(
            onClick = { onClick?.invoke() },
            enabled = onClick != null,
            colors =
                if (selected) {
                    IconButtonDefaults.filledIconButtonColors()
                } else {
                    IconButtonDefaults.iconButtonColors()
                },
            modifier = Modifier.semantics { this.selected = selected },
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(painterResource(icon), contentDescription = label)
                inkMark?.let {
                    Box(
                        Modifier
                            .size(INK_MARK_WIDTH, INK_MARK_HEIGHT)
                            .background(it.copy(alpha = 1f), RoundedCornerShape(2.dp)),
                    )
                }
            }
        }
    }
}
