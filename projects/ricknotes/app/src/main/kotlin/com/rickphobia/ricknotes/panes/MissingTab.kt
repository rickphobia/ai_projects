package com.rickphobia.ricknotes.panes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.layout.checkMissing
import com.rickphobia.ricknotes.logging.AppLog
import com.rickphobia.ricknotes.settings.LayoutSetting
import java.io.File

/**
 * Each time the app comes back, and when the screen opens after a restore, marks the Tabs whose
 * Document was moved or renamed outside the app, so they say so instead of failing to open.
 */
@Composable
internal fun MissingDocumentCheck(
    studyFolder: String,
    layout: LayoutSetting<*>,
) {
    LifecycleResumeEffect(studyFolder, layout) {
        val exists = { path: String -> File(studyFolder, path).isFile }
        layout.layout.panes
            .flatMap { it.tabs }
            .filter { !it.missing && !exists(it.path) }
            .map { it.path }
            .distinct()
            // The file name only: the folders above it name the owner's courses.
            .forEach { AppLog.w("Document missing (moved or renamed?): ${File(it).name}") }
        layout.change { checkMissing(exists) }
        onPauseOrDispose {}
    }
}

/** What a missing Tab shows in place of its Document: what happened, and [close]. */
@Composable
internal fun MissingDocument(close: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
    ) {
        Text(stringResource(R.string.document_missing), style = MaterialTheme.typography.bodyLarge)
        Button(onClick = close) { Text(stringResource(R.string.close_missing_tab)) }
    }
}
