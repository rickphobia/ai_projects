"""Plain text from the HTML a feed gives: one line for an excerpt, or paragraphs for a body.
No HTML from a feed is ever shown."""

import re
from html.parser import HTMLParser

# Tags that start a new paragraph in the text.
_BLOCKS = frozenset(
    {"p", "br", "div", "li", "tr", "blockquote", "pre", "h1", "h2", "h3", "h4", "h5", "h6"}
)


class _TextCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skipping = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("script", "style"):
            self._skipping += 1
        elif tag in _BLOCKS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style") and self._skipping:
            self._skipping -= 1
        elif tag in _BLOCKS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._skipping:
            self.parts.append(data)


def _text(html: str) -> str:
    collector = _TextCollector()
    collector.feed(html)
    collector.close()
    return "".join(collector.parts)


def plain_text(html: str) -> str:
    """All the text on one line."""
    return re.sub(r"\s+", " ", _text(html)).strip()


def paragraphs(html: str) -> str:
    """The text with one paragraph per line and no blank lines."""
    lines = (re.sub(r"\s+", " ", line).strip() for line in _text(html).split("\n"))
    return "\n".join(line for line in lines if line)


def cut(text: str, limit: int) -> str:
    """`text`, or its start ending in … when it is longer than `limit`."""
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"
