#!/usr/bin/env bash
# One-command deploy for Rukku's Expense Tracker.
# It stamps a fresh version onto the CSS/JS links (so browsers skip the cache),
# then commits and pushes — GitHub Pages rebuilds automatically.
#
# Usage:  ./deploy.sh "what I changed"
set -e

cd "$(dirname "$0")"

# 1. Cache-busting: set ?v=<current time> on the asset links in index.html
VERSION=$(date +%s)
sed -i '' -E "s/style\.css\?v=[0-9]+/style.css?v=$VERSION/" index.html
sed -i '' -E "s/app\.js\?v=[0-9]+/app.js?v=$VERSION/" index.html
echo "🔖 Stamped version: $VERSION"

# 2. Commit & push
MESSAGE="${1:-Update site}"
git add .
if git diff --cached --quiet; then
  echo "Nothing to deploy — no changes."
  exit 0
fi
git commit -m "$MESSAGE"
git push
echo "✅ Pushed. Live in ~1 minute at:"
echo "   https://pranambi.github.io/rukku-expense-tracker/"
