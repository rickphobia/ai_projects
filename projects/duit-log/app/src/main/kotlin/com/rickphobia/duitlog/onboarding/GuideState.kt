package com.rickphobia.duitlog.onboarding

/** What the notification access guide needs to know to pick its steps and show their status. */
data class GuideState(
    val sdkInt: Int,
    val accessGranted: Boolean,
    val notificationsAllowed: Boolean,
)
