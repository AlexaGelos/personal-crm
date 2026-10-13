#!/usr/bin/env bash
# Deploys one version of the app on the server:
#   pull the image -> migrations in a one-off container -> new app container -> smoke /health
#
# GitHub Actions copies this folder to the server and runs the script after every push to main.
# By hand on the server (e.g. to roll back to the previous version):
#   sudo -u deploy bash /srv/personal-crm/deploy.sh <full commit SHA>
#
# Any failed step stops the deploy with an error. Nothing is rolled back automatically.
set -euo pipefail

readonly IMAGE_REPO=ghcr.io/alexagelos/personal-crm
readonly HEALTH_URL=http://127.0.0.1:3000/health

SCRIPT=$(readlink -f "$0")
cd "$(dirname "$SCRIPT")"

sha=${1:-}
if [[ ! $sha =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: $0 <full commit SHA>" >&2
  exit 2
fi
export APP_IMAGE="$IMAGE_REPO:$sha"

log() { echo "[$(date -u +%FT%TZ)] $*" | tee -a deploy.log; }
compose() { docker compose -p prod "$@"; }

# One deploy at a time
exec 9>deploy.lock
if ! flock -n 9; then
  echo "Another deploy is running right now, try again later" >&2
  exit 1
fi

log "Deploying $sha"

# 1. Image. CI passes "<user> <token>" on stdin: a registry token that expires when the
# CI job ends. It is used only for this pull and is never written to the server's disk
if docker image inspect "$APP_IMAGE" >/dev/null 2>&1; then
  echo "Image is already on the server"
else
  registry_user='' registry_token=''
  [[ -t 0 ]] || read -r registry_user registry_token || true
  docker_config=$(mktemp -d)
  trap 'rm -rf "$docker_config"' EXIT
  if [[ -n $registry_token ]]; then
    DOCKER_CONFIG=$docker_config docker login ghcr.io -u "$registry_user" --password-stdin \
      <<<"$registry_token" >/dev/null
  fi
  DOCKER_CONFIG=$docker_config docker pull --quiet "$APP_IMAGE"
fi

# Remembered for cleanup and for the rollback hint
previous_image=$(docker inspect --format '{{.Config.Image}}' prod-app-1 2>/dev/null || true)

# 2. Migrations. If they fail, the current version keeps running untouched
log "Applying migrations"
if ! compose run --rm -T --quiet-pull migrate; then
  log "FAILED: migrations, $sha was not started. The previous version keeps running"
  exit 1
fi

# 3. New version of the app
log "Starting the app"
compose up -d --quiet-pull app

# 4. Smoke: /health must answer 200 within a minute
log "Smoke check $HEALTH_URL"
healthy=false
for _ in $(seq 30); do
  if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
    healthy=true
    break
  fi
  sleep 2
done

if [[ $healthy != true ]]; then
  log "FAILED: smoke, $HEALTH_URL does not answer 200. $sha is running but broken"
  compose logs --tail 50 app || true
  if [[ -n $previous_image && $previous_image != "$APP_IMAGE" ]]; then
    echo "To roll back by hand: ssh crm, then: sudo -u deploy bash $SCRIPT ${previous_image##*:}"
  fi
  exit 1
fi

log "OK: $sha is live"

# 5. Keep only the current and the previous image of the app on disk
docker image ls "$IMAGE_REPO" --format '{{.Repository}}:{{.Tag}}' | while read -r image; do
  if [[ $image != "$APP_IMAGE" && $image != "$previous_image" ]]; then
    docker image rm "$image" >/dev/null || echo "Could not remove $image"
  fi
done
