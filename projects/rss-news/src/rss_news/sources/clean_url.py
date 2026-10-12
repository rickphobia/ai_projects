"""Strips tracking parameters from a link, so the same story from two places has one URL."""

from urllib.parse import unquote_plus, urlsplit, urlunsplit

# Query parameters that only say where a click came from. Anything else may pick the page
# (an article id, a page number), so it is kept.
_TRACKING_PREFIXES = ("utm_", "at_", "mc_", "_hs", "guce_", "pk_")
_TRACKING_NAMES = frozenset(
    {
        "fbclid",
        "gclid",
        "dclid",
        "msclkid",
        "yclid",
        "igshid",
        "twclid",
        "ncid",
        "cmpid",
        "smid",
        "ref_src",
        "ref_url",
        "soc_src",
        "soc_trk",
        "guccounter",
        "__twitter_impression",
    }
)
_DEFAULT_PORTS = {"http": 80, "https": 443}


def clean_url(url: str) -> str:
    """`url` without tracking parameters, with its scheme and host in lower case.

    Path, other parameters and their order, and the fragment are kept as they are.
    """
    parts = urlsplit(url.strip())
    scheme = parts.scheme.lower()
    host = (parts.hostname or "").lower()
    netloc = host
    if parts.port is not None and parts.port != _DEFAULT_PORTS.get(scheme):
        netloc = f"{host}:{parts.port}"
    # Filter the raw "name=value" pairs rather than decode and re-encode them, so the kept
    # ones stay byte for byte as the site wrote them.
    kept = [
        pair
        for pair in parts.query.split("&")
        if pair and not _is_tracking(unquote_plus(pair.partition("=")[0]))
    ]
    return urlunsplit((scheme, netloc, parts.path, "&".join(kept), parts.fragment))


def _is_tracking(name: str) -> bool:
    lowered = name.lower()
    return lowered in _TRACKING_NAMES or lowered.startswith(_TRACKING_PREFIXES)
