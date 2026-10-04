#!/usr/bin/env bash
#
# Deploy FF Member to Cloudflare Pages: https://ff-member.pages.dev
#
#   npm run deploy                      # production
#   FF_BRANCH=preview npm run deploy    # preview branch, production untouched
#
# Same pattern as the other FF portfolio projects (ff-siena, ff-stanzza, ff-frames, ...): a DIRECT UPLOAD
# Pages project on Fakhrul's personal Cloudflare account, no git connection — pushing to
# GitHub deploys nothing; push and deploy are two acts. Multi-page build: no SPA fallback,
# Pages serves /studio from studio/index.html and unknown paths get 404.html.
# wrangler ≥4.13x delegates "pages" to Workers unless --force. Credentials: FF brand repo .env.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="ff-member"
BRANCH="${FF_BRANCH:-main}"
ENV_FILE="${FF_ENV:-$HOME/Desktop/dev/ffdevstudio/.env}"

[ -f "$ENV_FILE" ] || { echo "✗ no credentials at $ENV_FILE"; exit 1; }
set -a; . "$ENV_FILE"; set +a
: "${CLOUDFLARE_API_TOKEN:?missing in $ENV_FILE}"
: "${CLOUDFLARE_ACCOUNT_ID:?missing in $ENV_FILE}"

npm run build

npx --yes wrangler@latest pages project list 2>/dev/null | grep -q "│ $PROJECT " \
  || npx --yes wrangler@latest pages project create "$PROJECT" --production-branch main --force

npx --yes wrangler@latest pages deploy dist --project-name "$PROJECT" --branch "$BRANCH" --commit-dirty=true --force
