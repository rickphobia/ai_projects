package com.rickphobia.ricknotes.panes

import android.view.KeyEvent

/**
 * The keyboard shortcuts of the Document screen. `MainActivity` hands them the Ctrl keys no view
 * took, which is every one while the page list shows, since it never takes focus.
 */
class KeyShortcuts {
    /** What Ctrl+W does, set while a screen with Tabs shows. */
    var closeTab: (() -> Unit)? = null

    /** What Ctrl+\ does, set while a screen with Tabs shows. */
    var split: (() -> Unit)? = null

    /** True when [event] was a shortcut, run once per press however long the key is held. */
    fun handle(event: KeyEvent): Boolean {
        val action = if (event.isCtrlPressed) actionFor(event.keyCode) else null
        if (action != null && event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) action()
        return action != null
    }

    private fun actionFor(keyCode: Int): (() -> Unit)? =
        when (keyCode) {
            KeyEvent.KEYCODE_W -> closeTab
            KeyEvent.KEYCODE_BACKSLASH -> split
            else -> null
        }
}
