package com.rickphobia.gloss.ai

import com.rickphobia.gloss.core.ai.Ai
import com.rickphobia.gloss.core.ai.AiFailure
import com.rickphobia.gloss.core.ai.AiPrompt
import com.rickphobia.gloss.core.ai.AiReply
import com.rickphobia.gloss.core.ai.TokenUsage
import com.rickphobia.gloss.logging.RollingLog
import com.rickphobia.gloss.settings.AnthropicSettings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * The AI port on Anthropic's Messages API. Network errors get one retry after a short wait; the
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
            withOneRetry("messages model=${prompt.model}") { send("POST", "/v1/messages", key, requestBody(prompt)) }
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

    /** Checks [key] with a free call that lists one model. Returns null when Anthropic accepts it. */
    suspend fun checkKey(key: String): AiFailure? {
        val response = withOneRetry("key check") { send("GET", "/v1/models?limit=1", key, body = null) }
        return when {
            response == null -> AiFailure.NoInternet
            response.http.status == HttpURLConnection.HTTP_OK -> null.also { log.info("key check: accepted") }
            else -> failureFor(response.http.status).also { log.warning("key check: status=${response.http.status}") }
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
        val usage = TokenUsage(usageJson.getLong("input_tokens"), usageJson.getLong("output_tokens"))
        log.info(
            "messages model=$model status=200 input_tokens=${usage.inputTokens} " +
                "output_tokens=${usage.outputTokens} latency_ms=$latencyMillis retries=$retries " +
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

    private suspend fun withOneRetry(
        what: String,
        call: () -> HttpReply,
    ): Attempted? =
        withContext(Dispatchers.IO) {
            try {
                Attempted(call(), attempt = 1)
            } catch (e: IOException) {
                log.warning("$what: network error, retrying in ${settings.retryDelayMillis} ms: $e")
                delay(settings.retryDelayMillis)
                try {
                    Attempted(call(), attempt = 2)
                } catch (retryError: IOException) {
                    log.error("$what: network error again, giving up", retryError)
                    null
                }
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
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("content-type", "application/json")
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
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

    private fun requestBody(prompt: AiPrompt): String =
        JSONObject()
            .put("model", prompt.model)
            .put("max_tokens", prompt.maxTokens)
            .put("system", prompt.system)
            .put("messages", JSONArray().put(JSONObject().put("role", "user").put("content", prompt.userMessage)))
            .toString()

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

    private class Attempted(
        val http: HttpReply,
        val attempt: Int,
    )

    private companion object {
        const val NANOS_PER_MILLI = 1_000_000
    }
}
