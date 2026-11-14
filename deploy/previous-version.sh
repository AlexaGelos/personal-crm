#!/usr/bin/env bash
# Prints the full SHA of the version that a rollback of the prod goes to: the newest version
# deployed successfully before the one that runs now. Changes nothing.
# The workflow "Deploy prod" asks for it when the rollback box is ticked.
set -euo pipefail

SCRIPT=$(readlink -f "$0")
cd "$(dirname "$SCRIPT")"
source ./lib.sh
use_environment prod

version=$(previous_version)
if [[ ! $version =~ ^[0-9a-f]{40}$ ]]; then
  echo "There is no previous version of the prod in $LOG_FILE to roll back to" >&2
  exit 1
fi
echo "$version"
