# Starter Sources

The first set of Sources, grouped by Folder. Every feed below returned HTTP 200 with recent entries when fetched from the Beelink on 2026-10-11. The owner approves this list before it is loaded.

## AI

| Source | Feed |
|---|---|
| OpenAI News | https://openai.com/news/rss.xml |
| Google DeepMind | https://deepmind.google/blog/rss.xml |
| Google AI blog | https://blog.google/technology/ai/rss/ |
| Hugging Face blog | https://huggingface.co/blog/feed.xml |
| Simon Willison | https://simonwillison.net/atom/everything/ |
| Import AI (Jack Clark) | https://importai.substack.com/feed |
| Ahead of AI (Sebastian Raschka) | https://magazine.sebastianraschka.com/feed |
| Interconnects (Nathan Lambert) | https://www.interconnects.ai/feed |
| Latent Space | https://www.latent.space/feed |
| One Useful Thing (Ethan Mollick) | https://www.oneusefulthing.org/feed |
| Last Week in AI | https://lastweekin.ai/feed |
| MIT Technology Review, AI | https://www.technologyreview.com/topic/artificial-intelligence/feed |
| Nature news | https://www.nature.com/nature.rss |
| Quanta Magazine | https://api.quantamagazine.org/feed/ |
| r/LocalLLaMA, r/MachineLearning, r/singularity, r/ClaudeAI, r/OpenAI | `https://www.reddit.com/r/<sub>/top/.rss?t=day` |

## World

| Source | Feed |
|---|---|
| BBC World | https://feeds.bbci.co.uk/news/world/rss.xml |
| Al Jazeera | https://www.aljazeera.com/xml/rss/all.xml |
| The Guardian, World | https://www.theguardian.com/world/rss |
| NPR World | https://feeds.npr.org/1004/rss.xml |
| GDACS (disaster alerts) | https://www.gdacs.org/xml/rss.xml |
| USGS significant earthquakes | https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.atom |
| ReliefWeb disasters | https://reliefweb.int/disasters/rss.xml |
| r/worldnews | `https://www.reddit.com/r/worldnews/top/.rss?t=day` |

## Macro

| Source | Feed |
|---|---|
| Federal Reserve press releases | https://www.federalreserve.gov/feeds/press_all.xml |
| Federal Reserve speeches | https://www.federalreserve.gov/feeds/speeches.xml |
| ECB press | https://www.ecb.europa.eu/rss/press.html |
| Calculated Risk | https://www.calculatedriskblog.com/feeds/posts/default |
| Apricitas Economics | https://www.apricitas.io/feed |
| Noahpinion | https://www.noahpinion.blog/feed |
| The Big Picture (Barry Ritholtz) | https://ritholtz.com/feed/ |
| CNBC Economy | https://www.cnbc.com/id/20910258/device/rss/rss.html |
| MarketWatch top stories | https://feeds.content.dowjones.io/public/rss/mw_topstories |
| r/economics | `https://www.reddit.com/r/economics/top/.rss?t=day` |

## Stocks

| Source | Feed |
|---|---|
| Ticker news, one Source per Watchlist stock | `https://feeds.finance.yahoo.com/rss/2.0/headline?s=<TICKER>&region=US&lang=en-US`. Bursa tickers use `.KL` (e.g. `1155.KL`) and return fewer entries |
| CNBC Markets | https://www.cnbc.com/id/15839069/device/rss/rss.html |
| Seeking Alpha market news | https://seekingalpha.com/market_currents.xml |
| r/stocks, r/investing | `https://www.reddit.com/r/<sub>/top/.rss?t=day` |

## Malaysia

| Source | Feed |
|---|---|
| Free Malaysia Today | https://www.freemalaysiatoday.com/feed/ |
| Malaysiakini (English) | https://www.malaysiakini.com/rss/en/news.rss |
| Bernama | https://www.bernama.com/en/rssfeed.php |
| Malay Mail | https://www.malaymail.com/feed/rss/malaysia |
| CNA Asia | https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6511 |
| r/malaysia | `https://www.reddit.com/r/malaysia/top/.rss?t=day` |

## Tech

| Source | Feed |
|---|---|
| Hacker News (best) | https://hnrss.org/best |
| Lobsters | https://lobste.rs/rss |
| Ars Technica | https://feeds.arstechnica.com/arstechnica/index |
| The Verge | https://www.theverge.com/rss/index.xml |
| TechCrunch | https://techcrunch.com/feed/ |
| GitHub blog | https://github.blog/feed/ |
| r/programming, r/technology | `https://www.reddit.com/r/<sub>/top/.rss?t=day` |

## Gaps found while testing

- **Anthropic** has no RSS feed (`/rss.xml` and `/news/rss.xml` return 404). Its announcements reach us through Simon Willison, Hacker News and the AI subreddits.
- **The Star** (Malaysia): every `/rss/...` URL tried returns 404.
- **BLS** and **Science (AAAS)** return 403 to automated requests.
- **WHO news**: the feed works, but its newest entry is from February 2026.
- **Reuters and AP** have no official RSS feeds.
- **X**: out of scope.
- **Reddit** allows anonymous RSS but rate-limits it hard (a 429 after one request, resetting about 6 seconds later). Its JSON API returns 403 without OAuth.
