# Shared by deploy.sh and restore.sh: they source it after cd-ing into this folder.

readonly IMAGE_REPO=ghcr.io/alexagelos/personal-crm
readonly HEALTH_URL=http://127.0.0.1:3000/health
readonly APP_CONTAINER=prod-app-1
readonly BACKUP_DIR=$PWD/backups

log() { echo "[$(date -u +%FT%TZ)] $*" | tee -a deploy.log; }
compose() { docker compose -p prod "$@"; }

# One deploy or restore at a time
take_lock() {
  exec 9>deploy.lock
  if ! flock -n 9; then
    echo "Another deploy or restore is running right now, try again later" >&2
    exit 1
  fi
}

# Image of the app container, running or stopped. Empty if there is no container yet.
# The tag of the image is the app version: the SHA of its commit
current_app_image() {
  docker inspect --format '{{.Config.Image}}' "$APP_CONTAINER" 2>/dev/null || true
}

# backup_path <before-deploy|before-restore> <app version>
# The time comes before the version, so that sorting the names sorts the backups by age
backup_path() {
  echo "$BACKUP_DIR/$1-$(date -u +%Y%m%dT%H%M%SZ)-$2.dump"
}

# dump_database <file>
# Backups hold personal data, so only the deploy user can read them. The file gets its
# final name only after a complete dump: a broken dump never looks like a real backup.
# Callers run this inside "if", where set -e does not work, so errors are handled here.
# stdin is closed because "compose exec" would otherwise read it.
dump_database() {
  local target=$1
  install -d -m 700 "$BACKUP_DIR" || return 1
  if ! (
    umask 077
    compose exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
      </dev/null >"$target.partial"
  ); then
    rm -f "$target.partial"
    return 1
  fi
  mv "$target.partial" "$target"
}

# Smoke: /health must answer 200 within a minute
app_is_healthy() {
  for _ in $(seq 30); do
    if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}
