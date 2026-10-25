package com.rickphobia.gloss.ai

import com.rickphobia.gloss.core.ai.AiPrompt
import com.rickphobia.gloss.core.ai.ChatMessage
import com.rickphobia.gloss.core.ai.ChatMessage.Speaker
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class MessagesRequestTest {
    private val chat =
        listOf(
            ChatMessage(Speaker.Owner, "He avoided his landlady."),
            ChatMessage(Speaker.Ai, "He sneaked past her."),
            ChatMessage(Speaker.Owner, "why?"),
        )

    @Test
    fun `an Explain turn marks the system prompt for caching and sends the chat and effort`() {
        val body =
            JSONObject(
                messagesRequestBody(
                    AiPrompt("claude-sonnet-5-5", "Explain it.", chat, 1024, cacheSystem = true, effort = "low"),
                ),
            )

        val system = body.getJSONArray("system").getJSONObject(0)
        assertEquals("text", system.getString("type"))
        assertEquals("Explain it.", system.getString("text"))
        assertEquals("ephemeral", system.getJSONObject("cache_control").getString("type"))
        val messages = body.getJSONArray("messages")
        assertEquals(
            listOf("user", "assistant", "user"),
            (0 until messages.length()).map {
                messages.getJSONObject(it).getString("role")
            },
        )
        assertEquals("why?", messages.getJSONObject(2).getString("content"))
        assertEquals("low", body.getJSONObject("output_config").getString("effort"))
        assertEquals(1024, body.getInt("max_tokens"))
    }

    @Test
    fun `a Define sends plain instructions and no effort`() {
        val body = JSONObject(messagesRequestBody(AiPrompt("claude-haiku-5-5", "Define it.", chat.take(1), 150)))

        assertEquals("Define it.", body.getString("system"))
        assertFalse(body.has("output_config"))
    }
}
