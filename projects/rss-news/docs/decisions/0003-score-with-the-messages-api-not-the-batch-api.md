# Score with the Messages API, not the Batch API

The spec planned scoring on Anthropic's Message Batches API, which costs half as much. We score with plain Messages API calls instead, each one carrying a batch of up to 100 Items. Batch API results come back minutes to hours later, so an Importance 5 Item couldn't raise an Alert promptly, and the tick would have to keep submitted batches in the database and poll them across restarts. At about 500 Items a day, synchronous scoring costs roughly $3 a month on Claude Haiku 5.5 against about $1.50 on the Batch API.

**Trade-offs:** scoring costs about twice as much (about $1.50 more a month), and a large backlog uses several ticks' worth of calls in the background thread instead of one submission.
