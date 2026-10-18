#!/usr/bin/env bash
# r2-backup.sh — Daily sync of heroverse-assets R2 bucket to a backup bucket.
#
# Requirements:
#   rclone >= 1.60 installed on the server
#   Two rclone remotes configured in ~/.config/rclone/rclone.conf:
#     [primary-r2]    — the main heroverse-assets bucket
#     [backup-r2]     — the backup bucket (same or different provider)
#
# Rclone remote config examples (run `rclone config` interactively, or paste into
# ~/.config/rclone/rclone.conf):
#
# [primary-r2]
# type = s3
# provider = Cloudflare
# endpoint = https://<ACCOUNT_ID>.r2.cloudflarestorage.com
# access_key_id = <R2_ACCESS_KEY_ID>
# secret_access_key = <R2_SECRET_ACCESS_KEY>
# no_check_bucket = true
#
# [backup-r2]
# type = s3
# provider = Cloudflare                        # or Backblaze, AWS, etc.
# endpoint = https://<BACKUP_ACCOUNT_ID>.r2.cloudflarestorage.com
# access_key_id = <BACKUP_ACCESS_KEY_ID>
# secret_access_key = <BACKUP_SECRET_ACCESS_KEY>
# no_check_bucket = true
#
# Schedule (add to root crontab: `crontab -e`):
#   0 2 * * * /opt/herokids/scripts/r2-backup.sh >> /var/log/r2-backup.log 2>&1
#
# Usage:
#   ./r2-backup.sh               — full sync
#   ./r2-backup.sh --dry-run     — print what would be synced, write nothing

set -euo pipefail

PRIMARY_REMOTE="${PRIMARY_R2_REMOTE:-primary-r2}"
BACKUP_REMOTE="${BACKUP_R2_REMOTE:-backup-r2}"
PRIMARY_BUCKET="${R2_BUCKET_NAME:-heroverse-assets}"
BACKUP_BUCKET="${BACKUP_R2_BUCKET:-heroverse-assets-backup}"
LOG_PREFIX="[r2-backup $(date '+%Y-%m-%d %H:%M:%S')]"

DRY_RUN_FLAG=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN_FLAG="--dry-run"
  echo "$LOG_PREFIX DRY RUN — no changes will be made"
fi

echo "$LOG_PREFIX Starting sync: ${PRIMARY_REMOTE}:${PRIMARY_BUCKET} → ${BACKUP_REMOTE}:${BACKUP_BUCKET}"

rclone sync \
  "${PRIMARY_REMOTE}:${PRIMARY_BUCKET}" \
  "${BACKUP_REMOTE}:${BACKUP_BUCKET}" \
  --transfers 16 \
  --checkers 32 \
  --s3-chunk-size 16M \
  --stats 60s \
  --log-level INFO \
  ${DRY_RUN_FLAG}

EXIT_CODE=$?

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "$LOG_PREFIX ✓ Sync completed successfully"
else
  echo "$LOG_PREFIX ✗ Sync FAILED with exit code $EXIT_CODE" >&2
  # Extend here to send an alert: curl to a webhook, send an email, etc.
  # Example with a Slack webhook (set SLACK_WEBHOOK_URL in environment):
  # if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
  #   curl -s -X POST "$SLACK_WEBHOOK_URL" \
  #     -H 'Content-type: application/json' \
  #     --data "{\"text\":\"⚠️ R2 backup FAILED (exit $EXIT_CODE) — check /var/log/r2-backup.log\"}"
  # fi
fi

exit $EXIT_CODE
