package com.rickphobia.gloss.ai

import com.rickphobia.gloss.core.ai.AiFailure
import com.rickphobia.gloss.core.ai.AiPrompt
import com.rickphobia.gloss.core.ai.AiReply
import com.rickphobia.gloss.core.ai.ChatMessage
import com.rickphobia.gloss.logging.RollingLog
import com.rickphobia.gloss.settings.AnthropicSettings
import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.net.InetSocketAddress
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset

/** Drives the client's real HttpURLConnection against a local server standing in for Anthropic. */
class AnthropicClientTest {
    @get:Rule
    val folder = TemporaryFolder()

    private val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
    private val received = mutableListOf<Received>()
    private val log by lazy {
        RollingLog(File(folder.root, "logs"), Clock.fixed(Instant.parse("2026-10-25T14:25:00Z"), ZoneOffset.UTC))
    }

    private data class Received(
        val method: String,
        val path: String,
        val apiKey: String?,
        val contentType: String?,
        val body: String,
    )

    @After
    fun stopServer() = server.stop(0)

    private fun serve(
        status: Int,
        body: String,
    ) {
        server.createContext("/") { exchange ->
            received +=
                Received(
                    exchange.requestMethod,
                    exchange.requestURI.path,
                    exchange.requestHeaders.getFirst("x-api-key"),
                    exchange.requestHeaders.getFirst("content-type"),
                    exchange.requestBody.bufferedReader(Charsets.UTF_8).use { it.readText() },
                )
            val bytes = body.toByteArray(Charsets.UTF_8)
            exchange.sendResponseHeaders(status, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
        server.start()
    }

    private fun client(savedKey: String? = "sk-ant-test") =
        AnthropicClient(
            AnthropicSettings(
                baseUrl = "http://127.0.0.1:${server.address.port}",
                apiVersion = "2023-06-01",
                connectTimeoutMillis = 1_000,
                readTimeoutMillis = 2_000,
                retryDelayMillis = 10,
            ),
            { savedKey },
            log,
        )

    private val answer =
        """{"content":[{"type":"text","text":"A small house."}],"stop_reason":"end_turn",""" +
            """"usage":{"input_tokens":12,"output_tokens":4}}"""

    @Test
    fun `a key check posts a one-token request and accepts a 200`() {
        serve(200, answer)

        val failure = runBlocking { client(savedKey = null).checkKey("sk-ant-entered", "claude-haiku-5-5") }

        assertNull(failure)
        val request = received.single()
        assertEquals("POST", request.method)
        assertEquals("/v1/messages", request.path)
        assertEquals("sk-ant-entered", request.apiKey)
        assertEquals("application/json", request.contentType)
        assertEquals(1, JSONObject(request.body).getInt("max_tokens"))
    }

    @Test
    fun `a key check reports a rejected key`() {
        serve(401, """{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}""")

        val failure = runBlocking { client().checkKey("sk-ant-wrong", "claude-haiku-5-5") }

        assertEquals(AiFailure.KeyRejected, failure)
    }

    @Test
    fun `a prompt is posted as JSON and the answer read back`() {
        serve(200, answer)
        val prompt =
            AiPrompt(
                model = "claude-haiku-5-5",
                system = "Define the Selection.",
                messages = listOf(ChatMessage(ChatMessage.Speaker.Owner, "cottage")),
                maxTokens = 200,
            )

        val reply = runBlocking { client().ask(prompt) }

        assertEquals("A small house.", (reply as AiReply.Answer).text)
        assertEquals(12L, reply.usage.inputTokens)
        val request = received.single()
        assertEquals("sk-ant-test", request.apiKey)
        assertEquals("application/json", request.contentType)
        assertEquals("claude-haiku-5-5", JSONObject(request.body).getString("model"))
    }
}
