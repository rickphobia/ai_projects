import pytest

from rss_news.sources.clean_url import clean_url


@pytest.mark.parametrize(
    ("url", "cleaned"),
    [
        (
            "https://www.bbc.co.uk/news/articles/c6pv?at_medium=RSS&at_campaign=rss",
            "https://www.bbc.co.uk/news/articles/c6pv",
        ),
        (
            "https://example.com/story?utm_source=feed&utm_medium=rss&id=7&fbclid=abc",
            "https://example.com/story?id=7",
        ),
        ("https://example.com/story?gclid=1&mc_cid=2&mc_eid=3", "https://example.com/story"),
        ("HTTPS://Example.COM:443/Story", "https://example.com/Story"),
        ("http://example.com:80/a", "http://example.com/a"),
        ("https://example.com:8443/a", "https://example.com:8443/a"),
        ("https://example.com/a?b=1&a=2", "https://example.com/a?b=1&a=2"),
        ("https://example.com/a?q=a%20b&utm_term=x", "https://example.com/a?q=a%20b"),
        ("https://example.com/a#section-2", "https://example.com/a#section-2"),
        ("https://example.com/a?UTM_Source=x", "https://example.com/a"),
        ("  https://example.com/a  ", "https://example.com/a"),
    ],
)
def test_tracking_parameters_are_stripped_and_the_rest_kept(url: str, cleaned: str) -> None:
    assert clean_url(url) == cleaned


def test_the_same_story_with_different_tracking_parameters_cleans_to_one_url() -> None:
    from_feed = clean_url("https://example.com/story?utm_source=rss")
    from_newsletter = clean_url("https://example.com/story?utm_source=email&utm_campaign=daily")

    assert from_feed == from_newsletter == "https://example.com/story"
