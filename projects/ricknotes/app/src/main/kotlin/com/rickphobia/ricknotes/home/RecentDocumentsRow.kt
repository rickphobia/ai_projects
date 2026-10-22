package com.rickphobia.ricknotes.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.studyfolder.TreeNode

/** The Recent Documents, newest first, as one row of cards above the tree. */
@Composable
fun RecentDocumentsRow(
    documents: List<TreeNode.Document>,
    onOpen: (TreeNode.Document) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        Text(stringResource(R.string.recent_documents), style = MaterialTheme.typography.titleMedium)
        LazyRow(
            modifier = Modifier.padding(top = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(documents, key = TreeNode.Document::path) { document ->
                Card(onClick = { onOpen(document) }, modifier = Modifier.width(200.dp)) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = document.name,
                            style = MaterialTheme.typography.bodyLarge,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            text = document.folder,
                            style = MaterialTheme.typography.bodySmall,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }
    }
}
