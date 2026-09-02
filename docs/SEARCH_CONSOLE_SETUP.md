# Getting the Observatory into Google — Search Console Setup

**Status as of 2026-08-29:** `www.quranobservatory.org` is not in Google's index at all —
searching for the Arabic brand name (مرصد اللسانيات القرآنية) or even the literal domain
string returns nothing. The site itself is healthy: `robots.txt`, `sitemap.xml`, canonical
URLs, hreflang alternates, and localized titles/descriptions were all verified correct on
the live deployment. The blocker is **discovery** — the domain is new (renamed from
`quran.pluragate.org` in Aug 2026), nothing on the web links to it yet, and it has never
been submitted to any search engine.

The steps below fix that. Steps 1–4 are the ones that matter; 5–6 accelerate it.
Everything here is a dashboard/DNS task — no code changes required.

Facts you will need along the way:

| What | Value |
|---|---|
| Canonical host | `https://www.quranobservatory.org` (apex 308s to `www`) |
| Sitemap | `https://www.quranobservatory.org/sitemap.xml` |
| DNS host | **Cloudflare** (`dana.ns.cloudflare.com` / `rudy.ns.cloudflare.com`) |
| Old domain | `quran.pluragate.org` — 308-redirects correctly, nothing to do |

---

## 1. Add the property in Google Search Console

1. Open <https://search.google.com/search-console> and sign in with the Google account
   that should own the property (use the project account, not a personal throwaway —
   ownership transfers are a pain).
2. Property type: choose **Domain**, not "URL prefix". Enter `quranobservatory.org`
   (no `https://`, no `www`). A Domain property covers `www`/apex and http/https in one
   property, so you never have to wonder which variant the data landed in.

## 2. Verify ownership via DNS TXT (in Cloudflare)

Search Console shows a TXT record like `google-site-verification=XXXXXXXX…`. Copy it, then:

1. Open the **Cloudflare dashboard** → zone `quranobservatory.org` → **DNS → Records**.
2. Add a record: Type **TXT**, Name **@**, Content = the full
   `google-site-verification=…` string, TTL Auto. (TXT records are DNS-only; the
   orange-cloud proxy setting is irrelevant here.)
3. Wait a few minutes, then confirm it resolves before clicking anything:

   ```
   nslookup -type=TXT quranobservatory.org
   ```

4. Back in Search Console, click **Verify**. If it fails, wait 10–15 minutes and retry —
   it is always propagation, not the record.

Leave the TXT record in place permanently; Google re-checks it and un-verifies the
property if it disappears.

## 3. Submit the sitemap

In Search Console: **Indexing → Sitemaps** → enter `https://www.quranobservatory.org/sitemap.xml`
→ Submit. Status should flip to "Success" within a day, listing the discovered URLs
(locale pages + viz embed routes).

## 4. Request indexing for the key pages

The sitemap alone can take weeks for a zero-backlink domain; the URL Inspection tool jumps
the queue. For each URL below: paste it into the **inspection bar at the top** of Search
Console → wait for the check → click **Request Indexing**.

Priority order (there is a quota of roughly 10–12 requests/day — this list fits in one day):

1. `https://www.quranobservatory.org/ar` ← the page that answers the brand query
2. `https://www.quranobservatory.org/en`
3. `https://www.quranobservatory.org/`
4. `https://www.quranobservatory.org/ar/search`
5. `https://www.quranobservatory.org/en/search`

Indexing typically follows within hours to a few days per requested URL.

## 5. Bing Webmaster Tools (covers Bing, DuckDuckGo, Yahoo)

Open <https://www.bing.com/webmasters>, sign in, and use **Import from Google Search
Console** — it copies the verified property and sitemap in one step. No DNS work needed.

## 6. Backlinks — give crawlers a path in

Google finds and trusts new domains through links. Right now approximately nothing links
to this domain. Cheap, legitimate wins:

- [x] `README.md` already links `https://www.quranobservatory.org` (done — appears twice)
- [ ] GitHub repo **About** field (right sidebar → gear icon → Website) — set it to
      `https://www.quranobservatory.org`. GitHub pages are crawled constantly; this is
      the single fastest external link to get.
- [ ] Any profiles/posts you control: X/Twitter bio (`@pluragate`), LinkedIn, a
      Show HN / r/Quran / r/dataisbeautiful post when ready. Two or three real links
      measurably shorten discovery time.

## 7. What to expect, and how to monitor

- **Days 1–3 after step 4:** requested URLs appear. Check with a `site:` query
  (`site:quranobservatory.org` on Google) — this shows raw index presence without
  ranking noise.
- **The brand query** (مرصد اللسانيات القرآنية) should return `/ar` shortly after that
  page is indexed: it is an exact-match `<title>` with no real competition.
- **Ongoing:** Search Console → **Performance** shows impressions/clicks per query;
  **Indexing → Pages** shows what is in vs. excluded from the index.

### If pages stall in "Discovered / Crawled – currently not indexed"

Normal for a brand-new domain with no links — it is a priority signal, not an error.
The cure is step 6 (links) plus time; re-requesting indexing weekly does no harm.
Do **not** start changing metadata in response — it was verified correct, and churn
resets evaluation.

### If the favicon in results is still the old one

Google caches favicons separately from pages and refreshes them on its own
schedule, often weeks behind a deploy. You can see what it currently holds at
`https://www.google.com/s2/favicons?domain=quranobservatory.org&sz=64`. After
changing the icon, request indexing for the homepage (step 4) — that is the page
Google reads the favicon link from — and wait. The served files can be checked
directly: `/favicon.ico` and `/favicon.svg` must both draw the `#0e161a` plate
behind the mark, otherwise the icon vanishes on the white results page.
