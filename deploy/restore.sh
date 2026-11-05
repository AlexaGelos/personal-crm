#!/usr/bin/env bash
# Restores the production database from a backup file. Only a person runs this, by hand:
#   ssh crm
#   sudo -u deploy bash /srv/personal-crm/restore.sh /srv/personal-crm/backups/<file>
#
# Shows what will be replaced and waits for "yes" -> copies the current database
# -> stops the app -> drops and recreates the database -> loads the backup
# -> starts the same app container -> smoke /health
#
# The app version never changes. Nothing is rolled back automatically.
set -euo pipefail

SCRIPT=$(readlink -f "$0")
cd "$(dirname "$SCRIPT")"
source ./lib.sh

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <backup file>" >&2
  exit 2
fi
if [[ ! -f $1 || ! -r $1 ]]; then
  echo "Cannot read the backup file: $1. Nothing was changed" >&2
  exit 2
fi
backup_file=$(readlink -f -- "$1")

take_lock

app_image=$(current_app_image)
if [[ -z $app_image ]]; then
  echo "There is no container $APP_CONTAINER, so its version is unknown. Nothing was changed" >&2
  exit 1
fi
app_version=${app_image##*:}
# compose.yaml requires APP_IMAGE. It stays the version that is already there
export APP_IMAGE=$app_image

compose up -d --wait --quiet-pull db

if ! compose exec -T db pg_restore --list <"$backup_file" >/dev/null; then
  echo "This is not a database backup: $backup_file. Nothing was changed" >&2
  exit 1
fi

db_name=$(compose exec -T db sh -c 'echo "$POSTGRES_DB"' </dev/null)

cat <<EOF

This replaces the whole production database with the backup.
Everything written to the database after this backup was taken will be gone.

  Backup file:  $backup_file
                $(du -h "$backup_file" | cut -f1), taken $(date -u -r "$backup_file" '+%F %T UTC')
  Database:     $db_name, container prod-db-1, docker compose project prod
  App version:  $app_version (does not change)

EOF

# /health only checks the connection, so it would not notice a database older than the app
if [[ $(basename "$backup_file") != *"$app_version"* ]]; then
  cat <<EOF
WARNING: this backup was taken with another app version, see its file name.
The app may expect a newer database and break, even though /health stays green.
README, section on backups: roll the app back to that version first.

EOF
fi

read -r -p 'Type yes to continue: ' answer || answer=''
if [[ $answer != yes ]]; then
  echo "Nothing was changed"
  exit 1
fi

log "Restoring $backup_file, app version $app_version"

safety_copy=$(backup_path before-restore "$app_version")
log "Copying the current database to $safety_copy"
if ! dump_database "$safety_copy"; then
  log "FAILED: restore, could not copy the current database. Nothing was changed"
  exit 1
fi

log "Stopping the app"
compose stop app

# One transaction: if the backup does not load, the new database stays empty.
# Called inside "if", where set -e does not work, hence the &&
replace_database() {
  compose exec -T db sh -c \
    'dropdb -U "$POSTGRES_USER" --if-exists --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"' \
    </dev/null &&
    compose exec -T db sh -c \
      'exec pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --single-transaction' \
      <"$backup_file"
}

log "Replacing database $db_name"
if ! replace_database; then
  log "FAILED: restore of $backup_file. The app stays stopped, the database may be empty"
  echo "To get back the database as it was before: sudo -u deploy bash $SCRIPT $safety_copy"
  exit 1
fi

# The same container: its version cannot change
log "Starting the app"
compose start app

log "Smoke check $HEALTH_URL"
if ! app_is_healthy; then
  log "FAILED: smoke after restore, $HEALTH_URL does not answer 200. The database is restored"
  compose logs --tail 50 app || true
  echo "To get back the database as it was before: sudo -u deploy bash $SCRIPT $safety_copy"
  exit 1
fi

log "Restore finished: $backup_file, app version $app_version is running"
echo "The database as it was before the restore: $safety_copy"
