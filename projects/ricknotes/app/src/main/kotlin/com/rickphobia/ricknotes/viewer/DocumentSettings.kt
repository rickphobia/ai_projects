package com.rickphobia.ricknotes.viewer

import com.rickphobia.ricknotes.core.ink.FavouritePens
import com.rickphobia.ricknotes.core.touch.FingerGestures
import com.rickphobia.ricknotes.revisionlog.CourseFolder

/**
 * What an open Document takes from the settings: the pens that tapping the pen in use moves
 * through, what fingers do, and the Course folder whose Revision log its Entries go to (null when
 * it is in none), and the Study folder, whose Presets file Send to reads.
 */
class DocumentSettings(
    val favouritePens: FavouritePens,
    val fingerGestures: FingerGestures,
    val course: CourseFolder?,
    val studyFolder: String,
)
