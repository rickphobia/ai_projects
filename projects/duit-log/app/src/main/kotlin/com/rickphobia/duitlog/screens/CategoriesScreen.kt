package com.rickphobia.duitlog.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.rickphobia.duitlog.R
import com.rickphobia.duitlog.core.ledger.Category
import com.rickphobia.duitlog.core.ledger.Kind
import com.rickphobia.duitlog.core.ledger.LedgerException
import com.rickphobia.duitlog.core.ledger.OTHER

/**
 * The Expense and Income lists. Tapping a Category renames it; Delete asks where its Transactions
 * go. Other has neither. [categories] is read again by the caller after each change.
 */
@Composable
fun CategoriesScreen(
    categories: Map<Kind, List<Category>>,
    actions: CategoryActions,
    onBack: () -> Unit,
) {
    var naming by remember { mutableStateOf<Naming?>(null) }
    var deleting by remember { mutableStateOf<Category?>(null) }

    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .safeDrawingPadding()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = onBack) { Text("← " + stringResource(R.string.back)) }
                Text(stringResource(R.string.categories_title), style = MaterialTheme.typography.titleLarge)
            }
            Kind.entries.forEach { kind ->
                CategoryList(
                    kind = kind,
                    categories = categories[kind].orEmpty(),
                    onRename = { naming = Naming.Rename(it) },
                    onDelete = { deleting = it },
                    onAdd = { naming = Naming.Add(kind) },
                )
            }
        }
    }

    naming?.let { current ->
        CategoryNameDialog(
            start = (current as? Naming.Rename)?.category?.name ?: "",
            title = if (current is Naming.Add) R.string.add_category else R.string.rename_category,
            onSave = { name ->
                when (current) {
                    is Naming.Add -> actions.add(current.kind, name)
                    is Naming.Rename -> actions.rename(current.category.id, name)
                }
            },
            onClose = { naming = null },
        )
    }
    deleting?.let { category ->
        DeleteCategoryDialog(
            category = category,
            moveTargets = categories[category.kind].orEmpty().filter { it.id != category.id },
            actions = actions,
            onClose = { deleting = null },
        )
    }
}

/** What the name dialog is for. */
private sealed interface Naming {
    data class Add(
        val kind: Kind,
    ) : Naming

    data class Rename(
        val category: Category,
    ) : Naming
}

@Composable
private fun CategoryList(
    kind: Kind,
    categories: List<Category>,
    onRename: (Category) -> Unit,
    onDelete: (Category) -> Unit,
    onAdd: () -> Unit,
) {
    val title = if (kind == Kind.EXPENSE) R.string.expense_categories else R.string.income_categories
    Text(stringResource(title), style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 16.dp))
    categories.forEach { category ->
        val fixed = category.name == OTHER
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(enabled = !fixed) { onRename(category) }
                    .padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(category.name, modifier = Modifier.weight(1f))
            if (!fixed) {
                TextButton(onClick = { onDelete(category) }) {
                    Text(stringResource(R.string.delete), color = MaterialTheme.colorScheme.error)
                }
            }
        }
        HorizontalDivider()
    }
    TextButton(onClick = onAdd) { Text("+ " + stringResource(R.string.add_category)) }
}

@Preview
@Composable
private fun CategoriesScreenPreview() {
    val categories =
        mapOf(
            Kind.EXPENSE to
                listOf("Transport", "F&B", OTHER).mapIndexed { i, name -> Category(i.toLong(), Kind.EXPENSE, name) },
            Kind.INCOME to listOf("Salary", OTHER).mapIndexed { i, name -> Category(10L + i, Kind.INCOME, name) },
        )
    DuitLogTheme {
        CategoriesScreen(categories, CategoryActions({ _, _ -> }, { _, _ -> }, { 0 }, { _, _ -> }), onBack = {})
    }
}
