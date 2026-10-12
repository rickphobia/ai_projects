// Reads a text/event-stream body as it arrives. EventSource can't send a POST, so the PWA
// reads the stream itself.

export interface StreamEvent {
  event: string;
  data: string;
}

export async function* readEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffered += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      buffered = buffered.replaceAll("\r\n", "\n");
      let end = buffered.indexOf("\n\n");
      while (end !== -1) {
        const parsed = parseEvent(buffered.slice(0, end));
        if (parsed !== null) yield parsed;
        buffered = buffered.slice(end + 2);
        end = buffered.indexOf("\n\n");
      }
      if (done) return;
    }
  } finally {
    reader.releaseLock();
  }
}

function parseEvent(block: string): StreamEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    const colon = line.indexOf(":");
    // A line starting with ":" is a comment; one without a colon is a field with no value.
    if (colon === 0) continue;
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }
  return data.length === 0 ? null : { event, data: data.join("\n") };
}
