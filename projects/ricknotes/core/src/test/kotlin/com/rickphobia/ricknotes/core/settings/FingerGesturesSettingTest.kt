package com.rickphobia.ricknotes.core.settings

import com.rickphobia.ricknotes.core.touch.FingerGestures
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class FingerGesturesSettingTest {
    private val stored = mutableMapOf<String, String>()
    private val source = SettingsSource { stored[it] }
    private val store = SettingsStore { key, value -> stored[key] = value }

    @Test
    fun `nothing stored has every gesture off`() {
        assertEquals(
            FingerGestures(fingerErase = false, twoFingerTapUndo = false, threeFingerTapRedo = false),
            SettingsLoader.loadFingerGestures(source),
        )
    }

    @Test
    fun `saved switches load back, each on its own`() {
        val gestures = FingerGestures(fingerErase = true, twoFingerTapUndo = false, threeFingerTapRedo = true)

        SettingsLoader.saveFingerGestures(store, gestures)

        assertEquals(gestures, SettingsLoader.loadFingerGestures(source))
    }

    @Test
    fun `a stored switch that isn't true or false is rejected with its key`() {
        stored[SettingsLoader.TWO_FINGER_TAP_UNDO_KEY] = "yes"

        val error = assertThrows(InvalidSettingException::class.java) { SettingsLoader.loadFingerGestures(source) }

        assertEquals(SettingsLoader.TWO_FINGER_TAP_UNDO_KEY, error.key)
        assertEquals("yes", error.value)
    }
}
