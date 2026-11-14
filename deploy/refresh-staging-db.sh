#!/usr/bin/env bash
# Replaces the database of the staging with a copy of the prod data from a prod backup.
# Only a person runs this, by hand:
#   ssh crm
#   sudo -u deploy bash /srv/personal-crm/refresh-staging-db.sh [backup file]
#
# Without an argument it takes the newest backup that a deploy took in backups/.
# Shows what will be replaced and waits for "yes" -> stops the staging app -> drops and
# recreates the staging database -> loads the backup -> applies the migrations of the staging
# app version (the backup may be older than the app) -> starts the app -> smoke /health.
#
# Only the staging is touched: the backup is just read, the prod is not changed in any way.
# The staging has no copy of its own database: what was there is lost, it was a copy anyway.
set -euo pipefail

SCRIPT=$(readlink -f "$0")
cd "$(dirname "$SCRIPT")"
source ./lib.sh
use_environment staging

if [[ $# -gt 1 ]]; then
  echo "Usage: $0 [backup file]" >&2
  exit 2
fi

if [[ $# -eq 1 ]]; then
  backup_file=$1
else
  # The names start with the time, so the last one in the order is the newest
  backup_file=$(printf '%s\n' "$BACKUP_DIR"/before-deploy-*.dump | sort | tail -1)
fi
if [[ ! -f $backup_file || ! -r $backup_file ]]; then
  echo "Cannot read the backup file: $backup_file. Nothing was changed" >&2
  exit 2
fi
backup_file=$(readlink -f -- "$backup_file")

take_lock

app_image=$(current_app_image)
if [[ -z $app_image ]]; then
  echo "There is no container $APP_CONTAINER: deploy the staging first (merge to main). Nothing was changed" >&2
  exit 1
fi
app_version=${app_image##*:}
# compose.yaml requires APP_IMAGE. It stays the version that is already on the staging
export APP_IMAGE=$app_image

compose up -d --wait --quiet-pull db

if ! compose exec -T db pg_restore --list <"$backup_file" >/dev/null; then
  echo "This is not a database backup: $backup_file. Nothing was changed" >&2
  exit 1
fi

db_name=$(compose exec -T db sh -c 'echo "$POSTGRES_DB"' </dev/null)

cat <<EOF

This replaces the whole database of the STAGING with a copy of the prod data.
Everything that is in the staging database now will be gone.

  Backup file:  $backup_file
                $(du -h "$backup_file" | cut -f1), taken $(date -u -r "$backup_file" '+%F %T UTC')
  Database:     $db_name, container $ENVIRONMENT-db-1, docker compose project $ENVIRONMENT
  App version:  $app_version (does not change; its migrations are applied after the load)

EOF

read -r -p 'Type yes to continue: ' answer || answer=''
if [[ $answer != yes ]]; then
  echo "Nothing was changed"
  exit 1
fi

log "Refreshing the staging database from $backup_file"

log "Stopping the staging app"
compose stop app

# One transaction: if the backup does not load, the new database stays empty.
# No owners and no access rights: the staging has its own database user, the one of the prod
# may be named differently.
# Called inside "if", where set -e does not work, hence the &&
replace_database() {
  compose exec -T db sh -c \
    'dropdb -U "$POSTGRES_USER" --if-exists --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"' \
    </dev/null &&
    compose exec -T db sh -c \
      'exec pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --single-transaction --no-owner --no-acl' \
      <"$backup_file"
}

log "Replacing database $db_name"
if ! replace_database; then
  log "FAILED: load of $backup_file into the staging. The staging app stays stopped, the database may be empty"
  echo "Run this script again with a backup file, or deploy the staging again"
  exit 1
fi

# The backup may be older than the app, so the migrations of the app version go on top of it
log "Applying migrations"
if ! compose run --rm -T --quiet-pull migrate; then
  log "FAILED: migrations after the load. The staging app stays stopped"
  exit 1
fi

log "Starting the staging app"
compose start app

log "Smoke check $HEALTH_URL"
if ! app_is_healthy; then
  log "FAILED: smoke after the refresh, $HEALTH_URL does not answer 200. The database is loaded"
  compose logs --tail 50 app || true
  exit 1
fi

log "Staging database refreshed from $backup_file, app version $app_version is running"
