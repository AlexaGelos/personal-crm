#!/usr/bin/env bash
# Deploys one version of the app on the server:
#   database backup -> pull the image -> migrations in a one-off container
#   -> new app container -> smoke /health
#
# GitHub Actions copies this folder to the server and runs the script after every push to main.
# By hand on the server (e.g. to roll back to the previous version):
#   sudo -u deploy bash /srv/personal-crm/deploy.sh <full commit SHA>
#
# Any failed step stops the deploy with an error. Nothing is rolled back automatically.
set -euo pipefail

SCRIPT=$(readlink -f "$0")
cd "$(dirname "$SCRIPT")"
source ./lib.sh

readonly BACKUPS_TO_KEEP=30

sha=${1:-}
if [[ ! $sha =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: $0 <full commit SHA>" >&2
  exit 2
fi
export APP_IMAGE="$IMAGE_REPO:$sha"

# Successfully deployed versions from deploy.log, newest first, without repeats
deployed_versions() {
  { grep -o 'OK: [0-9a-f]\{40\}' deploy.log 2>/dev/null || true; } | cut -c5- | tac | awk '!seen[$0]++'
}

take_lock

# CI passes "<user> <token>" on stdin: a registry token that expires when the CI job ends.
# It is used only to pull the image and is never written to the server's disk.
# Read it before anything else, so that no other command gets it on its stdin
registry_user='' registry_token=''
[[ -t 0 ]] || read -r registry_user registry_token || true

log "Deploying $sha"

# 1. Backup, named after the version that is live before this deploy.
# If it fails, the current version keeps running untouched
previous_image=$(current_app_image)
previous_version=${previous_image##*:}
backup_file=$(backup_path before-deploy "${previous_version:-none}")
log "Backing up the database to $backup_file"
if ! { compose up -d --wait --quiet-pull db && dump_database "$backup_file"; }; then
  log "FAILED: backup, $sha was not started. The previous version keeps running"
  exit 1
fi

# 2. Image
if docker image inspect "$APP_IMAGE" >/dev/null 2>&1; then
  echo "Image is already on the server"
else
  docker_config=$(mktemp -d)
  trap 'rm -rf "$docker_config"' EXIT
  if [[ -n $registry_token ]]; then
    DOCKER_CONFIG=$docker_config docker login ghcr.io -u "$registry_user" --password-stdin \
      <<<"$registry_token" >/dev/null
  fi
  DOCKER_CONFIG=$docker_config docker pull --quiet "$APP_IMAGE"
fi

# 3. Migrations. If they fail, the current version keeps running untouched
log "Applying migrations"
if ! compose run --rm -T --quiet-pull migrate; then
  log "FAILED: migrations, $sha was not started. The previous version keeps running"
  exit 1
fi

# 4. New version of the app
log "Starting the app"
compose up -d --quiet-pull app

# 5. Smoke
log "Smoke check $HEALTH_URL"
if ! app_is_healthy; then
  log "FAILED: smoke, $HEALTH_URL does not answer 200. $sha is running but broken"
  compose logs --tail 50 app || true
  previous_sha=$(deployed_versions | grep -vxF "$sha" | head -1 || true)
  if [[ -n $previous_sha ]]; then
    echo "To roll back by hand: ssh crm, then: sudo -u deploy bash $SCRIPT $previous_sha"
  fi
  exit 1
fi

log "OK: $sha is live"

# 6. Keep on disk only the images of the last two successfully deployed versions:
# the current one and the previous one to roll back to
keep=$(deployed_versions | head -2 || true)
docker image ls "$IMAGE_REPO" --format '{{.Tag}}' | while read -r tag; do
  if ! grep -qxF "$tag" <<<"$keep"; then
    docker image rm "$IMAGE_REPO:$tag" >/dev/null || echo "Could not remove $IMAGE_REPO:$tag"
  fi
done

# 7. Keep on disk only the latest backups taken by deploys. The copies that restore.sh
# makes are not touched: they are rare and removed only by hand
printf '%s\n' "$BACKUP_DIR"/before-deploy-*.dump | head -n -"$BACKUPS_TO_KEEP" |
  xargs -r -d '\n' rm -f -- || echo "Could not remove old backups"
