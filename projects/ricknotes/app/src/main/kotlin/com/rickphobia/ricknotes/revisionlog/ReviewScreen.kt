package com.rickphobia.ricknotes.revisionlog

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleStartEffect
import com.rickphobia.ricknotes.R
import com.rickphobia.ricknotes.core.ink.Stroke
import com.rickphobia.ricknotes.core.revisionlog.DueCourse
import com.rickphobia.ricknotes.core.revisionlog.Entry
import com.rickphobia.ricknotes.core.revisionlog.EntryId
import com.rickphobia.ricknotes.core.revisionlog.EntryKind
import com.rickphobia.ricknotes.core.revisionlog.Grade
import com.rickphobia.ricknotes.ink.DrawnStroke
import com.rickphobia.ricknotes.ink.RedoPad
import com.rickphobia.ricknotes.logging.AppLog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/** A due card: an Entry and the course whose Revision log it is in. */
private class Card(
    val course: DueCourse,
    val entry: Entry,
)

/**
 * Review: every Entry due today from every Revision log in [studyFolder], one card at a time and
 * one course at a time, or only the course picked. Each rating is kept as soon as it is given, so
 * leaving halfway loses nothing.
 */
@Composable
fun ReviewScreen(
    studyFolder: File,
    onBack: () -> Unit,
) {
    val queue by produceState<List<DueCourse>?>(null, studyFolder) {
        value = withContext(Dispatchers.IO) { RevisionLogSessions.dueCourses(studyFolder) }
    }
    // The course picked, by Course folder path; null reviews them all.
    var picked by remember(studyFolder) { mutableStateOf<String?>(null) }
    // Rated cards leave today's Review; Again brings one back tomorrow, not now.
    val rated = remember(studyFolder) { mutableStateListOf<EntryId>() }
    // The log saves a moment after each rating anyway; this writes it at once on leaving or going
    // to the background, where the app may be killed before that moment.
    LifecycleStartEffect(Unit) { onStopOrDispose { RevisionLogSessions.saveAllInBackground() } }
    BackHandler(onBack = onBack)
    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack) { Text(stringResource(R.string.back)) }
            Text(stringResource(R.string.review), style = MaterialTheme.typography.headlineSmall)
        }
        val courses = queue
        if (courses == null) {
            Text(stringResource(R.string.review_loading), modifier = Modifier.padding(top = 16.dp))
            return@Column
        }
        val unrated = { course: DueCourse -> course.entries.filter { it.id !in rated } }
        CoursePicker(courses, picked, unrated, onPick = { picked = it })
        val card =
            courses
                .filter { picked == null || it.courseFolder == picked }
                .firstNotNullOfOrNull { course -> unrated(course).firstOrNull()?.let { Card(course, it) } }
        if (card == null) {
            val othersLeft = courses.any { unrated(it).isNotEmpty() }
            Text(
                stringResource(if (othersLeft) R.string.review_course_done else R.string.review_done),
                modifier = Modifier.padding(top = 16.dp),
            )
        } else {
            ReviewCard(card, remaining = unrated(card.course).size) { grade, redo ->
                if (redo.isNotEmpty()) {
                    card.course.session.addRedo(card.entry.id, redo)
                    AppLog.i("saved a Redo of Entry ${card.entry.id.value} in ${courseName(card.course)}")
                }
                card.course.session.rate(card.entry.id, grade)
                AppLog.i("rated ${card.entry.kind} Entry ${card.entry.id.value} in ${courseName(card.course)}: $grade")
                rated.add(card.entry.id)
            }
        }
    }
}

@Composable
private fun CoursePicker(
    courses: List<DueCourse>,
    picked: String?,
    unrated: (DueCourse) -> List<Entry>,
    onPick: (String?) -> Unit,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.padding(vertical = 8.dp).horizontalScroll(rememberScrollState()),
    ) {
        FilterChip(
            selected = picked == null,
            onClick = { onPick(null) },
            label = { Text(stringResource(R.string.all_courses, courses.sumOf { unrated(it).size })) },
        )
        courses.forEach { course ->
            FilterChip(
                selected = picked == course.courseFolder,
                onClick = { onPick(course.courseFolder) },
                label = { Text(stringResource(R.string.course_due, courseName(course), unrated(course).size)) },
            )
        }
    }
}

/**
 * One card: its front, with a writing area under it for a Mistake's Redo, then on Show answer its
 * back beside them and its why line, and Again or Good. The Redo, if any, is kept on rating.
 */
@Composable
private fun ReviewCard(
    card: Card,
    remaining: Int,
    onRate: (Grade, redo: List<Stroke>) -> Unit,
) {
    var answered by remember(card.entry.id) { mutableStateOf(false) }
    val redo = remember(card.entry.id) { mutableStateListOf<DrawnStroke>() }
    val rate = { grade: Grade -> onRate(grade, redo.map { it.stroke }) }
    val session = card.course.session
    Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
        Text(
            pluralStringResource(R.plurals.review_card_of, remaining, courseName(card.course), remaining),
            style = MaterialTheme.typography.labelLarge,
        )
        Text(entryTitle(card.entry), style = MaterialTheme.typography.titleMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.weight(1f).fillMaxWidth()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.weight(1f)) {
                Snip(session.frontSnip(card.entry), R.string.review_front, Modifier.fillMaxWidth())
                if (card.entry.kind == EntryKind.MISTAKE) {
                    Text(stringResource(R.string.redo_area), style = MaterialTheme.typography.labelMedium)
                    RedoPad(redo, Modifier.weight(1f).fillMaxWidth())
                }
            }
            if (answered) Snip(session.backSnip(card.entry), R.string.review_back, Modifier.weight(1f))
        }
        if (answered) {
            card.entry.why?.let { Text(stringResource(R.string.entry_why, it)) }
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                OutlinedButton(onClick = { rate(Grade.AGAIN) }) { Text(stringResource(R.string.again)) }
                Button(onClick = { rate(Grade.GOOD) }) { Text(stringResource(R.string.good)) }
            }
        } else {
            Button(onClick = { answered = true }) { Text(stringResource(R.string.show_answer)) }
        }
    }
}

private fun courseName(course: DueCourse) = course.courseFolder.substringAfterLast('/')
