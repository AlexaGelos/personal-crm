# Shared by deploy.sh, restore.sh and refresh-staging-db.sh: they source it after cd-ing into
# this folder and then call "use_environment prod|staging".

readonly IMAGE_REPO=ghcr.io/alexagelos/personal-crm
readonly BACKUP_DIR=$PWD/backups
# Only the lock and the log of the staging are needed outside of it: the prod deploy skips the
# image cleanup while a staging deploy is running and keeps the images of both logs
readonly STAGING_LOCK=deploy-staging.lock
readonly PROD_LOG=deploy.log
readonly STAGING_LOG=deploy-staging.log

# use_environment <prod|staging>
# One compose.yaml serves both environments. What differs is set here (none of it is a secret,
# the secrets are in the env file of the environment) and goes to compose.yaml as variables.
# The prod values are the ones the server had before the staging appeared: the file names of
# the prod have not changed.
use_environment() {
  ENVIRONMENT=$1
  case $ENVIRONMENT in
    prod)
      ENV_FILE=.env
      LOG_FILE=$PROD_LOG
      LOCK_FILE=deploy.lock
      # The port on 127.0.0.1 that nginx proxies the domain to
      export APP_PORT=3000
      # The address the app is opened on: the links in the login emails lead there
      export APP_URL=https://app.crmgelos.ru
      # 0 is "no limit": the prod runs as it always did
      export APP_MEM_LIMIT=0 DB_MEM_LIMIT=0
      ;;
    staging)
      ENV_FILE=.env.staging
      LOG_FILE=$STAGING_LOG
      LOCK_FILE=$STAGING_LOCK
      export APP_PORT=3001
      export APP_URL=https://test-app.crmgelos.ru
      # The server is small and shared with the prod: the staging must not take its memory
      export APP_MEM_LIMIT=384m DB_MEM_LIMIT=256m
      ;;
    *)
      echo "Unknown environment '$ENVIRONMENT': use prod or staging" >&2
      exit 2
      ;;
  esac
  APP_CONTAINER=$ENVIRONMENT-app-1
  HEALTH_URL=http://127.0.0.1:$APP_PORT/health
}

log() { echo "[$(date -u +%FT%TZ)] $*" | tee -a "$LOG_FILE"; }
compose() { docker compose -p "$ENVIRONMENT" --env-file "$ENV_FILE" "$@"; }

# One deploy or restore at a time in an environment. The prod and the staging do not wait
# for each other
take_lock() {
  exec 9>>"$LOCK_FILE"
  if ! flock -n 9; then
    echo "Another deploy or restore of $ENVIRONMENT is running right now, try again later" >&2
    exit 1
  fi
}

# True while a deploy to the staging is running (its lock is held)
staging_is_busy() {
  ( exec 8>>"$STAGING_LOCK" && ! flock -n 8 )
}

# Image of the app container, running or stopped. Empty if there is no container yet.
# The tag of the image is the app version: the SHA of its commit
current_app_image() {
  docker inspect --format '{{.Config.Image}}' "$APP_CONTAINER" 2>/dev/null || true
}

# Successfully deployed versions from a deploy log, newest first, without repeats
deployed_versions() {
  { grep -o 'OK: [0-9a-f]\{40\}' "${1:-$LOG_FILE}" 2>/dev/null || true; } | cut -c5- | tac | awk '!seen[$0]++'
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
