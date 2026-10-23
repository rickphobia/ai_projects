package com.rickphobia.ricknotes.imports

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.studyfolder.StudyFolder
import com.rickphobia.ricknotes.core.studyfolder.StudyFolderListingException
import com.rickphobia.ricknotes.core.studyfolder.TreeNode
import com.rickphobia.ricknotes.logging.AppLog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Picks the folder of [studyFolder] a shared PDF is copied into, opening at the tree path
 * [startFolder] (the top if it is gone). [onPick] gets the picked tree path.
 */
@Composable
fun ShareFolderPicker(
    studyFolder: String,
    startFolder: String,
    onPick: (String) -> Unit,
    onCancel: () -> Unit,
) {
    BackHandler(onBack = onCancel)
    val tree by produceState<TreeNode.Folder?>(null, studyFolder) {
        value =
            withContext(Dispatchers.IO) {
                try {
                    StudyFolder(File(studyFolder).toPath()).listTree { _, error ->
                        AppLog.w("left out of the folder picker: ${error.message}")
                    }
                } catch (e: StudyFolderListingException) {
                    AppLog.w("listing the Study folder for a shared PDF failed: ${e.message}", e)
                    TreeNode.Folder("", "", emptyList())
                }
            }
    }
    var path by remember { mutableStateOf(startFolder) }
    val folder = tree?.let { it.find(path) ?: it }

    Column(modifier = Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(stringResource(R.string.share_pdf_title), style = MaterialTheme.typography.headlineSmall)
        Text(
            text = folder?.path?.ifEmpty { null } ?: stringResource(R.string.share_study_folder_top),
            style = MaterialTheme.typography.titleMedium,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Button(onClick = { folder?.let { onPick(it.path) } }, enabled = folder != null) {
                Text(stringResource(R.string.share_save_here))
            }
            if (folder != null && folder.path.isNotEmpty()) {
                TextButton(onClick = { path = folder.path.substringBeforeLast('/', missingDelimiterValue = "") }) {
                    Text(stringResource(R.string.share_up))
                }
            }
            TextButton(onClick = onCancel) { Text(stringResource(R.string.cancel)) }
        }
        LazyColumn(modifier = Modifier.fillMaxWidth()) {
            items(folder?.children.orEmpty().filterIsInstance<TreeNode.Folder>(), key = { it.path }) { child ->
                Text(
                    text = child.name,
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.fillMaxWidth().clickable { path = child.path }.padding(vertical = 12.dp),
                )
            }
        }
    }
}

private fun TreeNode.Folder.find(path: String): TreeNode.Folder? =
    if (this.path == path) {
        this
    } else {
        children.filterIsInstance<TreeNode.Folder>().firstNotNullOfOrNull { it.find(path) }
    }
