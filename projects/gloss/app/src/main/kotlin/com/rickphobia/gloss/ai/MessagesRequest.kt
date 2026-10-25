package com.rickphobia.gloss.ai

import com.rickphobia.gloss.core.ai.AiPrompt
import com.rickphobia.gloss.core.ai.ChatMessage
import org.json.JSONArray
import org.json.JSONObject

/** The body of a `POST /v1/messages` request for [prompt]. */
internal fun messagesRequestBody(prompt: AiPrompt): String {
    val body =
        JSONObject()
            .put("model", prompt.model)
            .put("max_tokens", prompt.maxTokens)
            .put("system", systemField(prompt))
            .put("messages", JSONArray(prompt.messages.map(::messageJson)))
    if (prompt.effort != null) body.put("output_config", JSONObject().put("effort", prompt.effort))
    return body.toString()
}

/**
 * The instructions as plain text, or as one text block marked for caching, so the next turn of an
 * Explain chat reads them (and the Book context in them) from the cache at a tenth of the price.
 */
private fun systemField(prompt: AiPrompt): Any =
    if (prompt.cacheSystem) {
        JSONArray().put(
            JSONObject()
                .put("type", "text")
                .put("text", prompt.system)
                .put("cache_control", JSONObject().put("type", "ephemeral")),
        )
    } else {
        prompt.system
    }

private fun messageJson(message: ChatMessage): JSONObject {
    val role =
        when (message.from) {
            ChatMessage.Speaker.Owner -> "user"
            ChatMessage.Speaker.Ai -> "assistant"
        }
    return JSONObject().put("role", role).put("content", message.text)
}
