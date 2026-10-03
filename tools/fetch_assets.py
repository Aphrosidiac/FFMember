#!/usr/bin/env python3
"""fetch_assets.py — pull every asset off a reference page, with a provenance manifest.

    python3 fetch_assets.py https://reference.example -o docs/reference/2026-09-03/assets
    python3 fetch_assets.py saved.html --base https://reference.example -o out/
    python3 fetch_assets.py https://ref.example --pages /about /work --no-css
    python3 fetch_assets.py https://ref.example --urls docs/reference/<date>/dom/resources.txt -o out/

On a JS-rendered site (Nuxt, Next, any SPA) the server HTML is missing most of the media.
Run dom_capture.mjs first and pass its resources.txt with --urls: every URL the hydrated page
actually requested, including lazy media once --scroll has driven it.

Finds: <img src|srcset|data-src>, <source src|srcset>, <video src|poster>, <link> for
stylesheets/icons/preload, <script src>, og:image / twitter:image, inline style url(),
and — one level deep — url() references inside fetched CSS (fonts, background images).

Picks the LARGEST candidate in a srcset, and rewrites common CDN width params upward, since
sites routinely serve a 400px copy of a 4000px original.

Writes manifest.tsv: source_url, status, bytes, content_type, local_path, found_on.
Originals go in untouched — optimise into the build, never over the only copy you have.
"""
import argparse
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126 Safari/537.36")
CSS_URL = re.compile(r"url\(\s*['\"]?([^'\")]+)['\"]?\s*\)")
WIDTH_PARAM = re.compile(r"([?&](?:w|width|sz|size)=)(\d+)")
ASSET_EXT = (".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg", ".ico",
             ".woff", ".woff2", ".ttf", ".otf", ".eot", ".mp4", ".webm", ".mov",
             ".pdf", ".css", ".json", ".mp3", ".wav")


def get(url, timeout=30, retries=2):
    """Fetch, backing off once on a rate-limit rather than hammering into a block."""
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read(), r.status, r.headers.get("Content-Type", "").split(";")[0]
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < retries:
                wait = float(e.headers.get("Retry-After") or 0) or 5 * (attempt + 1)
                print(f"  [{e.code}] backing off {wait:.0f}s — {url}", file=sys.stderr)
                time.sleep(wait)
                continue
            raise


def best_srcset(value):
    """Largest candidate in a srcset."""
    best, best_w = None, -1
    for part in value.split(","):
        bits = part.strip().split()
        if not bits:
            continue
        url = bits[0]
        w = -1
        if len(bits) > 1:
            m = re.match(r"(\d+(?:\.\d+)?)([wx])", bits[1])
            if m:
                w = float(m.group(1)) * (1000 if m.group(2) == "x" else 1)
        if w > best_w:
            best, best_w = url, w
    return best


class Collector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        add = self.urls.append
        if tag in ("img", "source", "video", "audio", "embed"):
            for k in ("src", "data-src", "data-lazy-src", "poster", "href"):
                if a.get(k):
                    add(a[k])
            for k in ("srcset", "data-srcset", "imagesrcset"):
                if a.get(k):
                    s = best_srcset(a[k])
                    if s:
                        add(s)
        elif tag == "link":
            rel = (a.get("rel") or "").lower()
            if a.get("href") and any(r in rel for r in
                                     ("stylesheet", "icon", "preload", "apple-touch", "manifest")):
                add(a["href"])
        elif tag == "script" and a.get("src"):
            add(a["src"])
        elif tag == "meta":
            prop = (a.get("property") or a.get("name") or "").lower()
            if prop in ("og:image", "twitter:image", "og:video") and a.get("content"):
                add(a["content"])
        if a.get("style"):
            self.urls += CSS_URL.findall(a["style"])


def upsize(url):
    """Nudge common CDN width params up to something print-usable."""
    def rep(m):
        return m.group(1) + str(max(int(m.group(2)), 2400))
    return WIDTH_PARAM.sub(rep, url)


CTYPE_EXT = {
    "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/avif": ".avif",
    "image/gif": ".gif", "image/svg+xml": ".svg", "image/x-icon": ".ico",
    "image/vnd.microsoft.icon": ".ico", "font/woff2": ".woff2", "font/woff": ".woff",
    "font/ttf": ".ttf", "font/otf": ".otf", "video/mp4": ".mp4", "video/webm": ".webm",
    "audio/mpeg": ".mp3", "text/css": ".css", "application/pdf": ".pdf",
    "application/json": ".json", "text/html": ".html",
}


def local_name(url, seen, ctype=""):
    p = urllib.parse.urlparse(url)
    name = os.path.basename(p.path) or "index"
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)[:100]
    if not os.path.splitext(name)[1]:
        # A CDN endpoint like /_next/image?url=… carries no extension; take it from the type.
        name += CTYPE_EXT.get(ctype, ".bin")
    base, ext = os.path.splitext(name)
    n, out = 1, name
    while out in seen:
        n += 1
        out = f"{base}-{n}{ext}"
    seen.add(out)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("target", help="page URL, or a local HTML file (needs --base)")
    ap.add_argument("-o", "--out", default="assets")
    ap.add_argument("--base", help="base URL when target is a local file")
    ap.add_argument("--pages", nargs="*", default=[], help="extra paths on the same origin")
    ap.add_argument("--delay", type=float, default=0.15)
    ap.add_argument("--max", type=int, default=800)
    ap.add_argument("--no-css", action="store_true", help="skip following url() inside CSS")
    ap.add_argument("--js", action="store_true",
                    help="also download .js bundles (off by default — they crowd out the assets)")
    ap.add_argument("--no-upsize", action="store_true")
    ap.add_argument("--urls", help="file of absolute URLs to fetch as well (one per line), "
                                   "e.g. dom_capture.mjs resources.txt")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    pages = []
    if args.target.startswith(("http://", "https://")):
        base = args.base or args.target
        pages.append(args.target)
    else:
        if not args.base:
            sys.exit("a local HTML file needs --base <origin>")
        base = args.base
        pages.append(args.target)
    origin = "{0.scheme}://{0.netloc}".format(urllib.parse.urlparse(base))
    pages += [urllib.parse.urljoin(origin, p) for p in args.pages]

    found = []  # (absolute_url, found_on)
    for page in pages:
        try:
            if page.startswith(("http://", "https://")):
                body, _, _ = get(page)
                html = body.decode("utf-8", "replace")
                ref = page
            else:
                html = open(page, encoding="utf-8", errors="replace").read()
                ref = base
        except Exception as e:  # noqa: BLE001
            print(f"! {page}: {e}", file=sys.stderr)
            continue
        c = Collector()
        c.feed(html)
        for u in c.urls:
            if u.startswith("data:"):
                continue
            found.append((urllib.parse.urljoin(ref, u.strip()), ref))
        print(f"→ {page}: {len(c.urls)} references")
        time.sleep(args.delay)

    if args.urls:
        with open(args.urls, encoding="utf-8") as fh:
            extra = [ln.strip() for ln in fh if ln.strip().startswith(("http://", "https://"))]
        found += [(u, args.urls) for u in extra]
        print(f"→ {args.urls}: {len(extra)} urls")

    def kind(u):
        path = urllib.parse.urlparse(u).path.lower()
        if path.endswith((".woff2", ".woff", ".ttf", ".otf", ".eot")):
            return 0, "font"
        if path.endswith((".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg", ".ico")):
            return 1, "image"
        if path.endswith((".mp4", ".webm", ".mov", ".mp3", ".wav", ".pdf")):
            return 2, "media"
        if path.endswith(".css"):
            return 3, "css"
        if path.endswith((".js", ".mjs")):
            return 5, "js"
        return 4, "other"

    seen_urls, queue = set(), []
    for u, ref in found:
        if u in seen_urls:
            continue
        if not args.js and kind(u)[1] == "js":
            continue
        seen_urls.add(u)
        queue.append((u, ref))
    # Fonts, images and media before stylesheets and everything else, so a --max cap
    # never spends itself on bundles.
    queue.sort(key=lambda t: kind(t[0])[0])

    names, rows, css_seen = set(), [], 0
    i = 0
    while i < len(queue):
        if len(rows) >= args.max:
            print(f"  stopped at cap ({args.max}) — raise with --max")
            break
        url, ref = queue[i]
        i += 1
        fetch_url = url if args.no_upsize else upsize(url)
        try:
            body, status, ctype = get(fetch_url)
        except urllib.error.HTTPError as e:
            if fetch_url != url:  # upsize may 404; fall back to the original
                try:
                    body, status, ctype = get(url)
                    fetch_url = url
                except Exception as e2:  # noqa: BLE001
                    rows.append((url, getattr(e2, "code", "ERR"), 0, "", "", ref))
                    print(f"  [ERR] {url}")
                    continue
            else:
                rows.append((url, e.code, 0, "", "", ref))
                print(f"  [{e.code}] {url}")
                continue
        except Exception as e:  # noqa: BLE001
            rows.append((url, "ERR", 0, str(e)[:60], "", ref))
            print(f"  [ERR] {url} — {e}")
            continue

        name = local_name(fetch_url, names, ctype)
        path = os.path.join(args.out, name)
        with open(path, "wb") as fh:
            fh.write(body)
        rows.append((fetch_url, status, len(body), ctype, name, ref))
        print(f"  [{status}] {len(body):>9,} B  {name}")

        if not args.no_css and ("css" in ctype or fetch_url.split("?")[0].endswith(".css")):
            css_seen += 1
            text = body.decode("utf-8", "replace")
            for u in CSS_URL.findall(text):
                if u.startswith("data:"):
                    continue
                abs_u = urllib.parse.urljoin(fetch_url, u.strip())
                if abs_u not in seen_urls and (args.js or kind(abs_u)[1] != "js"):
                    seen_urls.add(abs_u)
                    queue.append((abs_u, fetch_url))
        time.sleep(args.delay)

    man = os.path.join(args.out, "manifest.tsv")
    with open(man, "w", encoding="utf-8") as fh:
        fh.write("source_url\tstatus\tbytes\tcontent_type\tlocal_path\tfound_on\n")
        for r in rows:
            fh.write("\t".join(str(x) for x in r) + "\n")

    ok = [r for r in rows if r[1] == 200]
    total = sum(r[2] for r in ok)
    by_kind = {}
    for r in ok:
        k = kind(r[0])[1]
        by_kind[k] = by_kind.get(k, 0) + 1
    print(f"\n{len(ok)}/{len(rows)} downloaded, {total:,} bytes, {css_seen} stylesheet(s) followed")
    print("  " + ", ".join(f"{v} {k}" for k, v in sorted(by_kind.items())))
    print(f"manifest → {man}")
    if len(rows) != len(ok):
        print("some fetches failed — see the manifest; a 403 on a font usually means it is "
              "domain-locked at the licensing CDN.")


if __name__ == "__main__":
    main()
