#!/usr/bin/env bash
# Deploys one version of the app to one environment (prod or staging) on the server.
# Prod:     database backup -> pull the image -> migrations in a one-off container
#           -> new app container -> smoke /health -> cleanup of old images and backups
# Staging:  the same, but without the backup and the cleanup
#
# GitHub Actions copies this folder to the server and runs the script: for the staging after
# every push to main (workflow "Deploy staging"), for the prod when the owner starts the
# workflow "Deploy prod". By hand on the server (e.g. to roll back to the previous version):
#   sudo -u deploy bash /srv/personal-crm/deploy.sh <prod|staging> <full commit SHA>
#
# Any failed step stops the deploy with an error. Nothing is rolled back automatically.
set -euo pipefail

SCRIPT=$(readlink -f "$0")
cd "$(dirname "$SCRIPT")"
source ./lib.sh

readonly BACKUPS_TO_KEEP=7
readonly IMAGE_MAX_AGE='2 weeks ago'

environment=${1:-}
sha=${2:-}
if [[ ! $environment =~ ^(prod|staging)$ || ! $sha =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: $0 <prod|staging> <full commit SHA>" >&2
  exit 2
fi
use_environment "$environment"
export APP_IMAGE="$IMAGE_REPO:$sha"

take_lock

# CI passes "<user> <token>" on stdin: a registry token that expires when the CI job ends.
# It is used only to pull the image and is never written to the server's disk.
# Read it before anything else, so that no other command gets it on its stdin
registry_user='' registry_token=''
[[ -t 0 ]] || read -r registry_user registry_token || true

log "Deploying $sha to $ENVIRONMENT"

# 1. Backup of the prod, named after the version that is live before this deploy.
# If it fails, the current version keeps running untouched. The staging has no backups:
# its database is a copy of the prod and can be made again (refresh-staging-db.sh)
if [[ $ENVIRONMENT == prod ]]; then
  previous_image=$(current_app_image)
  previous_version=${previous_image##*:}
  backup_file=$(backup_path before-deploy "${previous_version:-none}")
  log "Backing up the database to $backup_file"
  if ! { compose up -d --wait --quiet-pull db && dump_database "$backup_file"; }; then
    log "FAILED: backup, $sha was not started. The previous version keeps running"
    exit 1
  fi
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

# 3. Migrations. If they fail, the current version keeps running untouched.
# The one-off container starts the database of the environment too, if it is not running
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
  previous_sha=$(previous_version)
  if [[ -n $previous_sha ]]; then
    echo "To roll back by hand: ssh crm, then: sudo -u deploy bash $SCRIPT $ENVIRONMENT $previous_sha"
  fi
  exit 1
fi

log "OK: $sha is live"

# The cleanup below belongs to the prod deploy: the staging never removes anything
[[ $ENVIRONMENT == prod ]] || exit 0

# 6. Remove the images that were built more than 2 weeks ago, except the last two successfully
# deployed versions of the prod (the current one and the previous one to roll back to) and the
# version that runs on the staging now. An image that a container uses is never removed. While
# a staging deploy is running its new image may be pulled but not started yet, so the cleanup
# waits for the next time
if staging_is_busy; then
  echo "A staging deploy is running, the cleanup of old images is skipped this time"
else
  staging_image=$(staging_app_image)
  keep=$({ deployed_versions "$PROD_LOG" | head -2; echo "${staging_image##*:}"; } || true)
  oldest_to_keep=$(date -d "$IMAGE_MAX_AGE" +%s)
  docker image ls "$IMAGE_REPO" --format '{{.Tag}}' | while read -r tag; do
    grep -qxF "$tag" <<<"$keep" && continue
    built=$(docker image inspect --format '{{.Created}}' "$IMAGE_REPO:$tag") || continue
    built_at=$(date -d "$built" +%s) || continue
    (( built_at < oldest_to_keep )) || continue
    docker image rm "$IMAGE_REPO:$tag" >/dev/null || echo "Could not remove $IMAGE_REPO:$tag"
  done
fi

# 7. Keep on disk only the 7 latest backups taken by deploys. The daily backups have their own 7
# (backup.sh), and the copies that restore.sh makes are not touched: they are rare and
# removed only by hand
prune_backups before-deploy "$BACKUPS_TO_KEEP"
