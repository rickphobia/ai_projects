"""The approved starter Sources from docs/starter-sources.md, loaded on first run.

Ticker-news Sources come from the owner's Holdings and Watchlist, so they aren't here.
"""

from rss_news.sources.catalog import StarterFolder, StarterSource


def _subreddit(name: str) -> StarterSource:
    return StarterSource(f"r/{name}", f"https://www.reddit.com/r/{name}/top/.rss?t=day")


STARTER_FOLDERS: tuple[StarterFolder, ...] = (
    StarterFolder(
        "AI",
        (
            StarterSource("OpenAI News", "https://openai.com/news/rss.xml"),
            StarterSource("Google DeepMind", "https://deepmind.google/blog/rss.xml"),
            StarterSource("Google AI blog", "https://blog.google/technology/ai/rss/"),
            StarterSource("Hugging Face blog", "https://huggingface.co/blog/feed.xml"),
            StarterSource("Simon Willison", "https://simonwillison.net/atom/everything/"),
            StarterSource("Import AI (Jack Clark)", "https://importai.substack.com/feed"),
            StarterSource(
                "Ahead of AI (Sebastian Raschka)", "https://magazine.sebastianraschka.com/feed"
            ),
            StarterSource("Interconnects (Nathan Lambert)", "https://www.interconnects.ai/feed"),
            StarterSource("Latent Space", "https://www.latent.space/feed"),
            StarterSource(
                "One Useful Thing (Ethan Mollick)", "https://www.oneusefulthing.org/feed"
            ),
            StarterSource("Last Week in AI", "https://lastweekin.ai/feed"),
            StarterSource(
                "MIT Technology Review, AI",
                "https://www.technologyreview.com/topic/artificial-intelligence/feed",
            ),
            StarterSource("Nature news", "https://www.nature.com/nature.rss"),
            StarterSource("Quanta Magazine", "https://api.quantamagazine.org/feed/"),
            _subreddit("LocalLLaMA"),
            _subreddit("MachineLearning"),
            _subreddit("singularity"),
            _subreddit("ClaudeAI"),
            _subreddit("OpenAI"),
        ),
    ),
    StarterFolder(
        "World",
        (
            StarterSource("BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml"),
            StarterSource("Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml"),
            StarterSource("The Guardian, World", "https://www.theguardian.com/world/rss"),
            StarterSource("NPR World", "https://feeds.npr.org/1004/rss.xml"),
            StarterSource("GDACS (disaster alerts)", "https://www.gdacs.org/xml/rss.xml"),
            StarterSource(
                "USGS significant earthquakes",
                "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.atom",
            ),
            StarterSource("ReliefWeb disasters", "https://reliefweb.int/disasters/rss.xml"),
            _subreddit("worldnews"),
        ),
    ),
    StarterFolder(
        "Macro",
        (
            StarterSource(
                "Federal Reserve press releases",
                "https://www.federalreserve.gov/feeds/press_all.xml",
            ),
            StarterSource(
                "Federal Reserve speeches", "https://www.federalreserve.gov/feeds/speeches.xml"
            ),
            StarterSource("ECB press", "https://www.ecb.europa.eu/rss/press.html"),
            StarterSource(
                "Calculated Risk", "https://www.calculatedriskblog.com/feeds/posts/default"
            ),
            StarterSource("Apricitas Economics", "https://www.apricitas.io/feed"),
            StarterSource("Noahpinion", "https://www.noahpinion.blog/feed"),
            StarterSource("The Big Picture (Barry Ritholtz)", "https://ritholtz.com/feed/"),
            StarterSource("CNBC Economy", "https://www.cnbc.com/id/20910258/device/rss/rss.html"),
            StarterSource(
                "MarketWatch top stories",
                "https://feeds.content.dowjones.io/public/rss/mw_topstories",
            ),
            _subreddit("economics"),
        ),
    ),
    StarterFolder(
        "Stocks",
        (
            StarterSource("CNBC Markets", "https://www.cnbc.com/id/15839069/device/rss/rss.html"),
            StarterSource(
                "Seeking Alpha market news", "https://seekingalpha.com/market_currents.xml"
            ),
            _subreddit("stocks"),
            _subreddit("investing"),
        ),
    ),
    StarterFolder(
        "Malaysia",
        (
            StarterSource("Free Malaysia Today", "https://www.freemalaysiatoday.com/feed/"),
            StarterSource("Malaysiakini (English)", "https://www.malaysiakini.com/rss/en/news.rss"),
            StarterSource("Bernama", "https://www.bernama.com/en/rssfeed.php"),
            StarterSource("Malay Mail", "https://www.malaymail.com/feed/rss/malaysia"),
            StarterSource(
                "CNA Asia",
                "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6511",
            ),
            _subreddit("malaysia"),
        ),
    ),
    StarterFolder(
        "Tech",
        (
            StarterSource("Hacker News (best)", "https://hnrss.org/best"),
            StarterSource("Lobsters", "https://lobste.rs/rss"),
            StarterSource("Ars Technica", "https://feeds.arstechnica.com/arstechnica/index"),
            StarterSource("The Verge", "https://www.theverge.com/rss/index.xml"),
            StarterSource("TechCrunch", "https://techcrunch.com/feed/"),
            StarterSource("GitHub blog", "https://github.blog/feed/"),
            _subreddit("programming"),
            _subreddit("technology"),
        ),
    ),
)
