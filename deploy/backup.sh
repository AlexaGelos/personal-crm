#!/usr/bin/env bash
# Daily backup of the production database. Started by the systemd timer crm-backup.timer at
# 03:00 Moscow time (see crm-backup.service). By hand on the server:
#   sudo -u deploy bash /srv/personal-crm/backup.sh
#
# Waits (up to 10 minutes) for a deploy or restore that is running, takes the dump into
# backups/daily-<time>-<version>.dump and keeps the 7 latest daily backups. Nothing is removed
# if the dump failed. The progress is in backup.log (not in deploy.log: that one is read by
# line to find the deployed versions) and in the journal of the server.
set -euo pipefail

SCRIPT=$(readlink -f "$0")
cd "$(dirname "$SCRIPT")"
source ./lib.sh
use_environment prod
LOG_FILE=backup.log

readonly BACKUPS_TO_KEEP=7

# The same lock as deploy.sh and restore.sh: a dump taken in the middle of a restore would be
# an empty database, and 7 such dumps would push out all the good ones
take_lock 600

app_image=$(current_app_image)
if [[ -z $app_image ]]; then
  log "FAILED: daily backup, there is no container $APP_CONTAINER, so the app version is unknown"
  exit 1
fi
# compose.yaml requires APP_IMAGE, although the dump needs only the database
export APP_IMAGE=$app_image

backup_file=$(backup_path daily "${app_image##*:}")
log "Daily backup to $backup_file"
if ! dump_database "$backup_file"; then
  log "FAILED: daily backup, the dump was not taken. Older backups are kept"
  exit 1
fi

log "Daily backup done: $backup_file, $(du -h "$backup_file" | cut -f1)"
prune_backups daily "$BACKUPS_TO_KEEP"
