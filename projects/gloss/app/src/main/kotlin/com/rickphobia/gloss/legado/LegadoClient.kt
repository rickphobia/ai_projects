package com.rickphobia.gloss.legado

import com.rickphobia.gloss.core.context.Legado
import com.rickphobia.gloss.core.context.LegadoFailure
import com.rickphobia.gloss.core.context.LegadoReply
import com.rickphobia.gloss.core.context.ShelfBook
import com.rickphobia.gloss.logging.RollingLog
import com.rickphobia.gloss.settings.LegadoSettings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.io.IOException
import java.net.ConnectException
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.net.URLEncoder

/**
 * The Legado port on Legado's web service (decision 0001). Every reply is `{isSuccess, errorMsg,
 * data}`; anything else, a refused connection or a timeout becomes a [LegadoFailure], never an
 * exception. The log records which call failed and how, never a book's name or text.
 */
class LegadoClient(
    private val settings: LegadoSettings,
    private val log: RollingLog,
) : Legado {
    override suspend fun bookshelf(): LegadoReply<List<ShelfBook>> =
        call("bookshelf", "/getBookshelf") { data ->
            val books = (data as? JSONArray) ?: throw JSONException("data is not a list")
            (0 until books.length()).map { shelfBook(books.getJSONObject(it)) }
        }

    override suspend fun chapterText(
        bookUrl: String,
        chapterIndex: Int,
    ): LegadoReply<String> {
        val path = "/getBookContent?url=${URLEncoder.encode(bookUrl, "UTF-8")}&index=$chapterIndex"
        return call("chapter index=$chapterIndex", path) { data ->
            data as? String ?: throw JSONException("data is not text")
        }
    }

    private fun shelfBook(json: JSONObject): ShelfBook =
        ShelfBook(
            bookUrl = json.getString("bookUrl"),
            name = json.getString("name"),
            author = json.optString("author"),
            chapterIndex = json.optInt("durChapterIndex"),
            chapterTitle = json.optString("durChapterTitle"),
            chapterPosition = json.optInt("durChapterPos"),
            lastReadAtMillis = json.optLong("durChapterTime"),
        )

    private suspend fun <T> call(
        logLabel: String,
        path: String,
        read: (Any) -> T,
    ): LegadoReply<T> =
        withContext(Dispatchers.IO) {
            val started = System.nanoTime()
            val reply =
                try {
                    replyFrom(logLabel, get(path), read)
                } catch (e: ConnectException) {
                    log.info("legado $logLabel: web service off (${e.javaClass.simpleName})")
                    LegadoReply.Failed(LegadoFailure.Off)
                } catch (_: SocketTimeoutException) {
                    log.warning("legado $logLabel: no answer within the timeout")
                    LegadoReply.Failed(LegadoFailure.Slow)
                } catch (e: IOException) {
                    log.warning("legado $logLabel: network error: ${e.javaClass.simpleName}")
                    LegadoReply.Failed(LegadoFailure.Off)
                }
            if (reply is LegadoReply.Ok) {
                log.info("legado $logLabel: ok latency_ms=${(System.nanoTime() - started) / NANOS_PER_MILLI}")
            }
            reply
        }

    private fun <T> replyFrom(
        logLabel: String,
        http: HttpReply,
        read: (Any) -> T,
    ): LegadoReply<T> {
        if (http.status != HttpURLConnection.HTTP_OK) {
            log.warning("legado $logLabel: status=${http.status}")
            return LegadoReply.Failed(LegadoFailure.Error)
        }
        return try {
            val json = JSONObject(http.body)
            if (json.optBoolean("isSuccess")) {
                LegadoReply.Ok(read(json.get("data")))
            } else {
                // Not the message itself: a Permission Denial names the book's file.
                val errorMessage = json.optString("errorMsg")
                if (errorMessage.contains(PERMISSION_DENIAL)) {
                    log.warning("legado $logLabel: Legado can't read the book's file ($PERMISSION_DENIAL)")
                    LegadoReply.Failed(LegadoFailure.NoFileAccess)
                } else {
                    log.warning("legado $logLabel: isSuccess=false")
                    LegadoReply.Failed(LegadoFailure.Error)
                }
            }
        } catch (_: JSONException) {
            // Not the exception's message: org.json quotes the reply, which may hold the book's text.
            log.warning("legado $logLabel: unreadable reply")
            LegadoReply.Failed(LegadoFailure.Error)
        }
    }

    private fun get(path: String): HttpReply {
        val connection = URL(settings.baseUrl + path).openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = settings.connectTimeoutMillis
            connection.readTimeout = settings.readTimeoutMillis
            val status = connection.responseCode
            val stream =
                if (status <
                    HttpURLConnection.HTTP_BAD_REQUEST
                ) {
                    connection.inputStream
                } else {
                    connection.errorStream
                }
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            return HttpReply(status, text)
        } finally {
            connection.disconnect()
        }
    }

    private class HttpReply(
        val status: Int,
        val body: String,
    )

    private companion object {
        const val NANOS_PER_MILLI = 1_000_000
        const val PERMISSION_DENIAL = "Permission Denial"
    }
}
