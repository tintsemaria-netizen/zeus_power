#!/usr/bin/env bash
# Auto-deploy the Zeus Power dashboard + analyzer to prod.
#   build core -> regenerate analytics data -> build dashboard -> sync to web root
#   -> reload nginx -> commit -> push to origin/main
#
# SAFE SCOPE ONLY: this ships static analyzer/dashboard artifacts. It does NOT run,
# enable, or deploy any live network collector targeting third-party servers.
# Idempotent: a no-op when nothing changed.
set -euo pipefail

REPO=/home/claudeuser/projects/zeus_power
WEBROOT=/var/www/zeus_power
KEYFILE="$REPO/GitKey"
cd "$REPO"

log() { echo "[deploy] $*"; }

# 1. build + regenerate data + build dashboard
log "building core"
pnpm --filter @zeus/core build >/dev/null
log "regenerating analytics data"
npx tsx scripts/build-dashboard-data.ts >/dev/null
log "building dashboard"
pnpm --filter @zeus/dashboard build >/dev/null

# 2. deploy static build to web root
log "syncing to $WEBROOT"
sudo mkdir -p "$WEBROOT"
sudo cp -r packages/dashboard/dist/* "$WEBROOT"/
sudo chown -R www-data:www-data "$WEBROOT"
sudo nginx -t >/dev/null 2>&1 && sudo systemctl reload nginx
log "nginx reloaded"

# 3. commit any changes
git add -A
if git diff --cached --quiet; then
  log "no changes to commit; deploy done"
  exit 0
fi

# 3a. secret-scan guard (defense-in-depth beyond .gitignore + GH push protection)
if git diff --cached | grep -Eq 'ghp_[A-Za-z0-9]{36}|-----BEGIN [A-Z ]*PRIVATE KEY-----'; then
  log "ABORT: a secret was detected in the staged diff. Not committing/pushing."
  git reset -q
  exit 1
fi

STAMP=$(git log -1 --format=%h 2>/dev/null || echo init)
git commit -q -m "auto-deploy: dashboard/analyzer update

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" || true

# 4. push using the PAT via an ephemeral credential helper (never persisted to config)
if [ -f "$KEYFILE" ]; then
  git -c credential.helper="!f() { echo username=x-access-token; echo \"password=\$(cat $KEYFILE)\"; }; f" \
      push origin main 2>&1 | sed -E 's/ghp_[A-Za-z0-9]+/ghp_REDACTED/g'
  log "pushed to origin/main"
else
  log "WARN: $KEYFILE missing; committed locally but did not push"
fi
