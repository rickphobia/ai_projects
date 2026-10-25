package com.rickphobia.gloss.core

/** Something kept in storage, with the [id] the screens use to open, edit or delete it. */
data class Saved<T>(
    val id: Long,
    val value: T,
)
