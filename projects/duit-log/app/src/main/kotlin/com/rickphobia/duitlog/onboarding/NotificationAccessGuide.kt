package com.rickphobia.duitlog.onboarding

import android.os.Build
import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.rickphobia.duitlog.R
import com.rickphobia.duitlog.screens.DuitLogTheme

/**
 * The first-run guide: why duit-log needs notification access, then the steps to grant it.
 * Steps for features an Android version doesn't have are left out.
 */
@Composable
fun NotificationAccessGuide(
    state: GuideState,
    onOpenAppInfo: () -> Unit,
    onOpenNotificationAccess: () -> Unit,
    onAllowNotifications: () -> Unit,
    onDone: () -> Unit,
) {
    val restrictedSettings = state.sdkInt >= Build.VERSION_CODES.TIRAMISU
    val perAppSwitches = state.sdkInt >= Build.VERSION_CODES.S
    var step = 0
    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .safeDrawingPadding()
                    .verticalScroll(rememberScrollState())
                    .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(stringResource(R.string.guide_title), style = MaterialTheme.typography.headlineSmall)
            Text(stringResource(R.string.guide_why))
            Text(stringResource(R.string.guide_promise))
            if (restrictedSettings) {
                GuideStep(++step, R.string.guide_restricted_title, R.string.guide_restricted_body) {
                    OutlinedButton(onClick = onOpenAppInfo) { Text(stringResource(R.string.guide_open_app_info)) }
                }
            }
            GuideStep(++step, R.string.guide_access_title, R.string.guide_access_body) {
                if (state.accessGranted) {
                    Text(stringResource(R.string.guide_access_on), color = MaterialTheme.colorScheme.primary)
                } else {
                    Button(onClick = onOpenNotificationAccess) { Text(stringResource(R.string.guide_open_access)) }
                }
            }
            if (perAppSwitches) {
                GuideStep(++step, R.string.guide_other_apps_title, R.string.guide_other_apps_body) {
                    OutlinedButton(onClick = onOpenNotificationAccess) {
                        Text(stringResource(R.string.guide_open_access))
                    }
                }
            }
            if (restrictedSettings) {
                GuideStep(++step, R.string.guide_post_title, R.string.guide_post_body) {
                    if (state.notificationsAllowed) {
                        Text(stringResource(R.string.guide_post_on), color = MaterialTheme.colorScheme.primary)
                    } else {
                        OutlinedButton(onClick = onAllowNotifications) {
                            Text(stringResource(R.string.guide_allow_notifications))
                        }
                    }
                }
            }
            Button(onClick = onDone, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.guide_done)) }
        }
    }
}

@Composable
private fun GuideStep(
    number: Int,
    @StringRes title: Int,
    @StringRes body: Int,
    action: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            stringResource(R.string.guide_step, number, stringResource(title)),
            style = MaterialTheme.typography.titleMedium,
        )
        Text(stringResource(body), style = MaterialTheme.typography.bodyMedium)
        action()
    }
}

@Preview
@Composable
private fun NotificationAccessGuidePreview() {
    DuitLogTheme {
        NotificationAccessGuide(
            state =
                GuideState(
                    sdkInt = Build.VERSION_CODES.TIRAMISU,
                    accessGranted = false,
                    notificationsAllowed = true,
                ),
            onOpenAppInfo = {},
            onOpenNotificationAccess = {},
            onAllowNotifications = {},
            onDone = {},
        )
    }
}
