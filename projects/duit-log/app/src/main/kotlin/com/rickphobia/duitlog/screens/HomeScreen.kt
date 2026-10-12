package com.rickphobia.duitlog.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.rickphobia.duitlog.R

/** The home screen. Empty for now apart from the version and "Share log"; the Month comes later. */
@Composable
fun HomeScreen(
    versionName: String,
    buildNumber: Int,
    onShareLog: () -> Unit,
) {
    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.safeDrawingPadding().padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(stringResource(R.string.app_name), style = MaterialTheme.typography.headlineMedium)
            Text(
                stringResource(R.string.version, versionName, buildNumber),
                style = MaterialTheme.typography.bodyMedium,
            )
            OutlinedButton(onClick = onShareLog) { Text(stringResource(R.string.share_log)) }
        }
    }
}

@Preview
@Composable
private fun HomeScreenPreview() {
    DuitLogTheme { HomeScreen(versionName = "0.1.0", buildNumber = 1, onShareLog = {}) }
}
