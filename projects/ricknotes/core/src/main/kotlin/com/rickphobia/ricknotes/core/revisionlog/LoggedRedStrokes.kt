package com.rickphobia.ricknotes.core.revisionlog

import com.rickphobia.ricknotes.core.ink.StrokeId

/**
 * Every red stroke ID logged from the Document at [documentPath], by its Entries and by deleted
 * ones: Red marks leaves them out.
 */
fun RevisionLogSession.loggedRedStrokes(documentPath: String): Set<StrokeId> =
    entries.filter { it.source.documentPath == documentPath }.flatMapTo(mutableSetOf()) { it.redStrokeIds } +
        deletedRedStrokes[documentPath].orEmpty()
