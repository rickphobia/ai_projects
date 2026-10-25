package com.rickphobia.gloss.legado

import com.rickphobia.gloss.core.context.LegadoFailure
import com.rickphobia.gloss.core.context.LegadoReply
import com.rickphobia.gloss.core.context.ShelfBook
import com.rickphobia.gloss.logging.RollingLog
import com.rickphobia.gloss.settings.LegadoSettings
import com.sun.net.httpserver.HttpExchange
import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.URLDecoder
import java.net.URLEncoder
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

/** Drives the client against a local server that answers with Legado's replies (resources/legado/). */
class LegadoClientTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
    private val requests = mutableListOf<String>()
    private val log by lazy {
        RollingLog(File(folder.root, "logs"), Clock.fixed(Instant.parse("2026-10-25T09:30:00Z"), ZoneOffset.UTC))
    }

    private val localEpubUrl =
        "content://com.android.externalstorage.documents/document/primary%3ABooks%2FCrime%20and%20Punishment.epub"

    @After
    fun stopServer() = server.stop(0)

    private fun serve(respond: (HttpExchange) -> Pair<Int, String>) {
        server.createContext("/") { exchange ->
            requests += exchange.requestURI.rawPath + "?" + exchange.requestURI.rawQuery.orEmpty()
            val (status, body) = respond(exchange)
            val bytes = body.toByteArray(Charsets.UTF_8)
            exchange.sendResponseHeaders(status, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
        server.start()
    }

    private fun serveFile(name: String) = serve { 200 to recorded(name) }

    private fun recorded(name: String): String =
        checkNotNull(javaClass.getResource("/legado/$name")) { "missing test resource legado/$name" }.readText()

    private fun client(
        port: Int = server.address.port,
        readTimeoutMillis: Int = 2_000,
    ) = LegadoClient(LegadoSettings("http://127.0.0.1:$port", connectTimeoutMillis = 1_000, readTimeoutMillis), log)

    private fun logText(): String = log.exportTo(File(folder.root, "export.txt")).readText()

    @Test
    fun `reads every book on the bookshelf with where the owner is in it`() {
        serveFile("bookshelf.json")

        val reply = runBlocking { client().bookshelf() }

        val books = (reply as LegadoReply.Ok).value
        assertEquals(3, books.size)
        assertEquals(
            ShelfBook(
                bookUrl = localEpubUrl,
                name = "Crime and Punishment",
                author = "Fyodor Dostoevsky",
                chapterIndex = 3,
                chapterTitle = "Part I, Chapter 1",
                chapterPosition = 412,
                lastReadAtMillis = 1_761_300_000_000,
            ),
            books[1],
        )
        assertEquals("Chapter 2. Father and Son", books[0].chapterTitle)
        assertEquals(0L, books[2].lastReadAtMillis)
        // JSON nulls and missing fields are empty, not the text "null".
        assertEquals("", books[2].chapterTitle)
        assertEquals("", books[2].author)
        assertEquals(listOf("/getBookshelf?"), requests)
    }

    @Test
    fun `reads a local EPUB's chapter, asking for the book's URL and the chapter's index`() {
        serveFile("chapter-local-epub.json")

        val reply = runBlocking { client().chapterText(localEpubUrl, 3) }

        val text = (reply as LegadoReply.Ok).value
        assertTrue(text.startsWith("Part I, Chapter 1\n　　On an exceptionally hot evening"))
        val query = requests.single().substringAfter("?")
        assertEquals("url=${URLEncoder.encode(localEpubUrl, "UTF-8")}&index=3", query)
        assertEquals(localEpubUrl, URLDecoder.decode(query.substringAfter("url=").substringBefore("&"), "UTF-8"))
    }

    @Test
    fun `reads an online book's chapter`() {
        serveFile("chapter-online.json")

        val reply = runBlocking { client().chapterText("https://www.example-novels.com/book/12345/", 1) }

        assertTrue((reply as LegadoReply.Ok).value.contains("“Good-day, father,” said he"))
    }

    @Test
    fun `a Permission Denial is no file access, and the log doesn't name the file`() {
        serveFile("chapter-permission-denial.json")

        val reply = runBlocking { client().chapterText(localEpubUrl, 3) }

        assertEquals(LegadoReply.Failed(LegadoFailure.NoFileAccess), reply)
        assertFalse(logText().contains("Crime"))
    }

    @Test
    fun `a bookshelf entry without a book URL or name is left out`() {
        serve {
            200 to
                """{"isSuccess":true,"errorMsg":"","data":[{"name":"No URL"},{"bookUrl":"x","name":null},""" +
                """{"bookUrl":"https://example.com/b","name":"Kept","durChapterTime":5}]}"""
        }

        val books = (runBlocking { client().bookshelf() } as LegadoReply.Ok).value

        assertEquals(listOf("Kept"), books.map { it.name })
    }

    @Test
    fun `any other isSuccess false is an error`() {
        serve { 200 to """{"isSuccess":false,"errorMsg":"未找到书籍","data":null}""" }

        assertEquals(LegadoReply.Failed(LegadoFailure.Error), runBlocking { client().bookshelf() })
    }

    @Test
    fun `a reply that isn't Legado's JSON is an error`() {
        serve { 200 to "<html>Not Legado</html>" }

        assertEquals(LegadoReply.Failed(LegadoFailure.Error), runBlocking { client().bookshelf() })
    }

    @Test
    fun `a bookshelf whose data isn't a list is an error`() {
        serve { 200 to """{"isSuccess":true,"errorMsg":"","data":"nope"}""" }

        assertEquals(LegadoReply.Failed(LegadoFailure.Error), runBlocking { client().bookshelf() })
    }

    @Test
    fun `an HTTP error status is an error`() {
        serve { 500 to "Internal error" }

        assertEquals(LegadoReply.Failed(LegadoFailure.Error), runBlocking { client().chapterText(localEpubUrl, 3) })
    }

    @Test
    fun `nothing listening on the port means the web service is off`() {
        val closedPort = ServerSocket(0).use { it.localPort }

        val reply = runBlocking { client(port = closedPort).bookshelf() }

        assertEquals(LegadoReply.Failed(LegadoFailure.Off), reply)
        assertTrue(logText().contains("legado bookshelf: web service off"))
    }

    @Test
    fun `no answer within the read timeout is slow`() {
        serve {
            Thread.sleep(1_000)
            200 to recorded("bookshelf.json")
        }

        val reply = runBlocking { client(readTimeoutMillis = 100).bookshelf() }

        assertEquals(LegadoReply.Failed(LegadoFailure.Slow), reply)
    }

    @Test
    fun `the log records each call but never a book's name or text`() {
        serveFile("chapter-local-epub.json")

        runBlocking { client().chapterText(localEpubUrl, 3) }

        val logged = logText()
        assertTrue(logged.contains("legado chapter index=3: ok latency_ms="))
        assertFalse(logged.contains("garret"))
        assertFalse(logged.contains("Crime"))
    }
}
