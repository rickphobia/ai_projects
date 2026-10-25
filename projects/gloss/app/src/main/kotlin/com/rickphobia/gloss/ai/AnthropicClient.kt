package com.rickphobia.gloss.ai

import com.rickphobia.gloss.core.ai.Ai
import com.rickphobia.gloss.core.ai.AiFailure
import com.rickphobia.gloss.core.ai.AiPrompt
import com.rickphobia.gloss.core.ai.AiReply
import com.rickphobia.gloss.core.ai.ChatMessage
import com.rickphobia.gloss.core.ai.TokenUsage
import com.rickphobia.gloss.logging.RollingLog
import com.rickphobia.gloss.settings.AnthropicSettings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.json.JSONException
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * The AI port on Anthropic's Messages API. A failed connection gets one retry after a short wait; the
 * log records the model, tokens, latency and retries of every call, never the prompt or answer.
 */
class AnthropicClient(
    private val settings: AnthropicSettings,
    private val apiKey: () -> String?,
    private val log: RollingLog,
) : Ai {
    override suspend fun ask(prompt: AiPrompt): AiReply {
        val key = apiKey()
        if (key == null) {
            log.warning("messages: no key saved")
            return AiReply.Failed(AiFailure.NoKey)
        }
        val started = System.nanoTime()
        val response =
            withOneRetry(
                "messages model=${prompt.model}",
            ) { send("POST", "/v1/messages", key, messagesRequestBody(prompt)) }
        val latencyMillis = (System.nanoTime() - started) / NANOS_PER_MILLI
        return when {
            response == null -> AiReply.Failed(AiFailure.NoInternet)
            else -> readReply(prompt.model, response, latencyMillis)
        }
    }

    private fun readReply(
        model: String,
        response: Attempted,
        latencyMillis: Long,
    ): AiReply =
        try {
            replyFrom(model, response.attempt, latencyMillis, response.http)
        } catch (_: JSONException) {
            // Not the exception's message: org.json quotes the JSON it couldn't read, which may hold the answer.
            log.error("messages model=$model status=${response.http.status}: unreadable reply")
            AiReply.Failed(AiFailure.AiError)
        }

    /**
     * Checks [key] with a one-token call to [model], so a key that can't pay for or use the model
     * is caught too. Returns null when Anthropic answers.
     */
    suspend fun checkKey(
        key: String,
        model: String,
    ): AiFailure? {
        val testPrompt =
            AiPrompt(
                model = model,
                system = "Reply with one word.",
                messages = listOf(ChatMessage(ChatMessage.Speaker.Owner, "Hi")),
                maxTokens = 1,
            )
        val response = withOneRetry("key check") { send("POST", "/v1/messages", key, messagesRequestBody(testPrompt)) }
        return when {
            response == null -> {
                AiFailure.NoInternet
            }

            response.http.status == HttpURLConnection.HTTP_OK -> {
                null.also { log.info("key check: accepted") }
            }

            else -> {
                log.warning("key check: status=${response.http.status} error=${errorType(response.http.body)}")
                failureFor(response.http.status)
            }
        }
    }

    private fun replyFrom(
        model: String,
        attempt: Int,
        latencyMillis: Long,
        http: HttpReply,
    ): AiReply {
        val retries = attempt - 1
        if (http.status != HttpURLConnection.HTTP_OK) {
            log.error(
                "messages model=$model status=${http.status} error=${errorType(http.body)} " +
                    "latency_ms=$latencyMillis retries=$retries",
            )
            return AiReply.Failed(failureFor(http.status))
        }
        val json = JSONObject(http.body)
        val usageJson = json.getJSONObject("usage")
        val usage =
            TokenUsage(
                inputTokens = usageJson.getLong("input_tokens"),
                outputTokens = usageJson.getLong("output_tokens"),
                cacheWriteTokens = usageJson.optLong("cache_creation_input_tokens"),
                cacheReadTokens = usageJson.optLong("cache_read_input_tokens"),
            )
        log.info(
            "messages model=$model status=200 input_tokens=${usage.inputTokens} " +
                "output_tokens=${usage.outputTokens} cache_write_tokens=${usage.cacheWriteTokens} " +
                "cache_read_tokens=${usage.cacheReadTokens} latency_ms=$latencyMillis retries=$retries " +
                "stop_reason=${json.optString("stop_reason")}",
        )
        val content = json.getJSONArray("content")
        val text =
            (0 until content.length())
                .map(content::getJSONObject)
                .filter { it.optString("type") == "text" }
                .joinToString("") { it.getString("text") }
        return AiReply.Answer(text, usage)
    }

    /**
     * Runs [call], and once more after a short wait if it couldn't connect. A failure after the
     * request went out (such as a read timeout) isn't retried: Anthropic may have run, and billed,
     * it already.
     */
    private suspend fun withOneRetry(
        logLabel: String,
        call: () -> HttpReply,
    ): Attempted? =
        withContext(Dispatchers.IO) {
            try {
                try {
                    Attempted(call(), attempt = 1)
                } catch (e: NotConnectedException) {
                    log.warning("$logLabel: couldn't connect, retrying in ${settings.retryDelayMillis} ms: ${e.cause}")
                    delay(settings.retryDelayMillis)
                    Attempted(call(), attempt = 2)
                }
            } catch (e: IOException) {
                log.error("$logLabel: network error, giving up", e.cause ?: e)
                null
            }
        }

    private fun send(
        method: String,
        path: String,
        key: String,
        body: String?,
    ): HttpReply {
        val connection = URL(settings.baseUrl + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = settings.connectTimeoutMillis
            connection.readTimeout = settings.readTimeoutMillis
            connection.setRequestProperty("x-api-key", key)
            connection.setRequestProperty("anthropic-version", settings.apiVersion)
            try {
                connection.connect()
            } catch (e: IOException) {
                throw NotConnectedException(e)
            }
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("content-type", "application/json")
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val succeeded = status < HttpURLConnection.HTTP_BAD_REQUEST
            val stream = if (succeeded) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            return HttpReply(status, text)
        } finally {
            connection.disconnect()
        }
    }

    /** Anthropic's error type (such as `overloaded_error`), for the log; its message may quote the request. */
    private fun errorType(body: String): String =
        try {
            JSONObject(body).getJSONObject("error").getString("type")
        } catch (_: JSONException) {
            "unreadable"
        }

    private fun failureFor(status: Int): AiFailure =
        when (status) {
            HttpURLConnection.HTTP_UNAUTHORIZED, HttpURLConnection.HTTP_FORBIDDEN -> AiFailure.KeyRejected
            else -> AiFailure.AiError
        }

    private class HttpReply(
        val status: Int,
        val body: String,
    )

    /** The request never reached Anthropic, so sending it again can't double-bill. */
    private class NotConnectedException(
        cause: IOException,
    ) : IOException(cause)

    private class Attempted(
        val http: HttpReply,
        val attempt: Int,
    )

    private companion object {
        const val NANOS_PER_MILLI = 1_000_000
    }
}
