package com.rickphobia.duitlog.storage

import java.time.Clock
import java.time.Instant
import java.time.ZoneId

/**
 * The phone's clock and its current time zone. Unlike [Clock.systemDefaultZone], it reads the zone
 * on every call, so a trip abroad moves the day and Month boundaries without restarting the app.
 */
class PhoneClock : Clock() {
    override fun getZone(): ZoneId = ZoneId.systemDefault()

    override fun withZone(zone: ZoneId): Clock = system(zone)

    override fun instant(): Instant = Instant.now()
}
