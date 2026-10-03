#!/usr/bin/env bash
# snapshot.sh — dated snapshot of a reference site's static surface.
#
#   ./snapshot.sh https://reference.example docs/reference [extra/path ...]
#
# Saves robots.txt, sitemap(s), llms.txt, and the raw HTML of every URL found
# (or given) into docs/reference/<YYYY-MM-DD>/, plus a manifest.
#
# This captures the SERVER-RENDERED surface only. Anything JS-rendered or behind
# a login must be captured with the browser tool. It is deliberately polite:
# one request at a time with a delay, a real UA, and a cap on page count.
# Raise MAX_PAGES to take a whole site; the cap is there to stop a runaway, not to
# limit the crawl. Back off (raise DELAY) only if the origin starts returning 429.
set -euo pipefail

BASE="${1:?usage: snapshot.sh <base-url> [outdir] [extra paths...]}"
OUT="${2:-docs/reference}"
shift 2 || shift 1 || true
MAX_PAGES="${MAX_PAGES:-150}"
DELAY="${DELAY:-0.3}"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"

BASE="${BASE%/}"
DAY="$(date +%F)"
DIR="$OUT/$DAY"
mkdir -p "$DIR/raw"

get() { curl -sSL --max-time 25 -A "$UA" "$1"; }

# Many sites answer a missing file with a 200 HTML page. Keep only real ones.
fetch_meta() {
  local url="$1" dest="$2" want="$3"
  local code
  code=$(curl -sSL --max-time 25 -A "$UA" -o "$dest" -w '%{http_code}' "$url" || echo 000)
  if [ "$code" != "200" ] || [ ! -s "$dest" ]; then rm -f "$dest"; return 1; fi
  case "$want" in
    xml)  grep -qiE '<(urlset|sitemapindex)' "$dest" || { rm -f "$dest"; return 1; } ;;
    text) grep -qiE '<html|<!doctype' "$dest" && { rm -f "$dest"; return 1; } ;;
  esac
  return 0
}

echo "→ $BASE  ->  $DIR"
fetch_meta "$BASE/robots.txt"  "$DIR/robots.txt"  text && echo "  saved robots.txt"
fetch_meta "$BASE/llms.txt"    "$DIR/llms.txt"    text && echo "  saved llms.txt"
if ! fetch_meta "$BASE/sitemap.xml" "$DIR/sitemap.xml" xml; then
  # robots.txt often points somewhere else
  if [ -f "$DIR/robots.txt" ]; then
    alt=$(grep -iE '^[[:space:]]*sitemap:' "$DIR/robots.txt" | head -1 | sed -E 's/^[^:]*:[[:space:]]*//' | tr -d '\r')
    [ -n "${alt:-}" ] && fetch_meta "$alt" "$DIR/sitemap.xml" xml && echo "  saved sitemap.xml (from robots.txt: $alt)"
  fi
else
  echo "  saved sitemap.xml"
fi

URLS="$DIR/urls.txt"
: > "$URLS"

# URLs from the sitemap (follows one level of sitemap index).
if [ -f "$DIR/sitemap.xml" ]; then
  grep -oE '<loc>[^<]+</loc>' "$DIR/sitemap.xml" | sed -E 's#</?loc>##g' > "$DIR/.locs" || true
  while read -r loc; do
    case "$loc" in
      *.xml) get "$loc" | grep -oE '<loc>[^<]+</loc>' | sed -E 's#</?loc>##g' >> "$URLS" || true ;;
      *) echo "$loc" >> "$URLS" ;;
    esac
  done < "$DIR/.locs"
  rm -f "$DIR/.locs"
fi

# Plus the homepage, plus any paths passed on the command line.
echo "$BASE/" >> "$URLS"
for p in "$@"; do echo "$BASE/${p#/}" >> "$URLS"; done

sed -E 's#/$##' "$URLS" | sed -E 's#^(https?://[^/]+)$#\1/#' | sort -u -o "$URLS"
TOTAL=$(wc -l < "$URLS" | tr -d ' ')
echo "  $TOTAL url(s) discovered; fetching up to $MAX_PAGES"

MANIFEST="$DIR/manifest.tsv"
printf 'url\tstatus\tbytes\tfile\n' > "$MANIFEST"
n=0
while read -r url; do
  [ -z "$url" ] && continue
  n=$((n + 1))
  [ "$n" -gt "$MAX_PAGES" ] && { echo "  stopped at cap ($MAX_PAGES)"; break; }
  slug=$(printf '%s' "$url" | sed -E 's#^https?://##; s#[^A-Za-z0-9._-]#_#g' | cut -c1-100)
  file="raw/$slug.html"
  code=$(curl -sSL --max-time 25 -A "$UA" -o "$DIR/$file" -w '%{http_code}' "$url" || echo 000)
  bytes=$(wc -c < "$DIR/$file" | tr -d ' ')
  printf '%s\t%s\t%s\t%s\n' "$url" "$code" "$bytes" "$file" >> "$MANIFEST"
  printf '  [%s] %s (%s B)\n' "$code" "$url" "$bytes"
  sleep "$DELAY"
done < "$URLS"

echo "done → $DIR (manifest.tsv, raw/)"
echo "Reminder: JS-rendered and logged-in surfaces are NOT in here. Capture those with the browser tool."
