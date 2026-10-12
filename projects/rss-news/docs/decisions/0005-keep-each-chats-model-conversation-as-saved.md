# Keep each Chat's model conversation as the API returned it

Each Chat stores the whole Messages API conversation (`chats.context`), thinking and `search_items` calls included, and sends it back unchanged with the next question. The answers the owner sees (`chat_messages`) are saved separately. Rebuilding the conversation from `chat_messages` would be provider-neutral, but it would drop the model's thinking blocks and tool calls. Claude Opus 5.5 needs those passed back unchanged for its preserved thinking, and they are what lets a follow-up know which Items and windows were already searched. Server-side compaction (ticket 14) also returns blocks that must be kept as they came.

**Trade-offs:** stored Chats are tied to the Anthropic message format. Changing provider means old Chats can be shown but not continued, unless they are converted. The context column also grows with every turn until compaction trims it.
