#!/usr/bin/env bash
set -euo pipefail

ACCESS_LOG="${1:-}"
ALERTS_LOG="${ALERTS_LOG:-logs/alerts.log}"
STORE_ALERTS_DB="${STORE_ALERTS_DB:-0}"
DB_SERVICE="${DB_SERVICE:-alerts-db}"
DB_USER="${DB_USER:-lab}"
DB_NAME="${DB_NAME:-alerts}"

if [[ -z "$ACCESS_LOG" ]]; then
  echo "Usage: scripts/monitor-nginx-logs.sh <access_log>"
  exit 1
fi

mkdir -p "$(dirname "$ALERTS_LOG")"
touch "$ACCESS_LOG" "$ALERTS_LOG"

PATTERN='(\.env|\.git|\.sql|\.bak|\.zip|backup|config|union[[:space:]]+select|select.+from|<script>|%3cscript%3e|javascript:|\.\./|\.\.%2f|/etc/passwd|/admin|POST /login)'

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

alert_type_for_line() {
  local line="$1"
  if echo "$line" | grep -E -qi '(\.env|\.git|\.sql|\.bak|\.zip|backup|config)'; then
    echo "Sensitive File Access"
  elif echo "$line" | grep -E -qi '(union[[:space:]]+select|select.+from|or[[:space:]]+1=1|information_schema)'; then
    echo "SQL Injection Pattern"
  elif echo "$line" | grep -E -qi '(<script>|%3cscript%3e|javascript:|onerror=|onload=)'; then
    echo "XSS Pattern"
  elif echo "$line" | grep -E -qi '(\.\./|\.\.%2f|%2e%2e|/etc/passwd)'; then
    echo "Directory Traversal"
  elif echo "$line" | grep -E -qi 'POST /login'; then
    echo "Login Attempt"
  elif echo "$line" | grep -E -qi '/admin'; then
    echo "Admin Path Probe"
  else
    echo "Suspicious Request"
  fi
}

severity_for_type() {
  case "$1" in
    "SQL Injection Pattern"|"Directory Traversal"|"Sensitive File Access") echo "High" ;;
    "XSS Pattern"|"Admin Path Probe") echo "Medium" ;;
    *) echo "Low" ;;
  esac
}

init_db() {
  docker compose --profile alerts-db exec -T "$DB_SERVICE" psql -U "$DB_USER" -d "$DB_NAME" -c "
CREATE TABLE IF NOT EXISTS security_alerts (
  id SERIAL PRIMARY KEY,
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  source_ip TEXT,
  request_line TEXT,
  status_code INT,
  alert_type TEXT,
  severity TEXT,
  raw_log TEXT
);" >/dev/null
}

insert_db_alert() {
  local line="$1"
  local alert_type="$2"
  local severity="$3"
  local source_ip status_code request_line raw

  source_ip="$(printf "%s" "$line" | awk '{print $1}')"
  status_code="$(printf "%s" "$line" | awk '{for (i=1; i<=NF; i++) if ($i ~ /^"[0-9][0-9][0-9]$/) print substr($i,2); else if ($i ~ /^[0-9][0-9][0-9]$/) s=$i} END { if (s) print s }' | tail -n 1)"
  request_line="$(printf "%s" "$line" | sed -n 's/^[^"]*"\([^"]*\)".*/\1/p')"
  raw="$(sql_escape "$line")"
  source_ip="$(sql_escape "$source_ip")"
  request_line="$(sql_escape "$request_line")"
  alert_type="$(sql_escape "$alert_type")"
  severity="$(sql_escape "$severity")"

  if [[ ! "$status_code" =~ ^[0-9]+$ ]]; then
    status_code="NULL"
  fi

  docker compose --profile alerts-db exec -T "$DB_SERVICE" psql -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO security_alerts (source_ip, request_line, status_code, alert_type, severity, raw_log)
VALUES ('$source_ip', '$request_line', $status_code, '$alert_type', '$severity', '$raw');" >/dev/null || true
}

if [[ "$STORE_ALERTS_DB" == "1" ]]; then
  echo "Database alert storage enabled. Initializing table if database is running..."
  init_db || echo "Could not initialize database alert table. File alerts will still work."
fi

echo "Monitoring $ACCESS_LOG"
echo "Alerts will be appended to $ALERTS_LOG"

tail -n 0 -f "$ACCESS_LOG" | while IFS= read -r line; do
  if echo "$line" | grep -E -qi "$PATTERN"; then
    now="$(date '+%Y-%m-%d %H:%M:%S')"
    alert_type="$(alert_type_for_line "$line")"
    severity="$(severity_for_type "$alert_type")"
    alert="[ALERT] $now Suspicious request detected: $line"
    echo "$alert"
    echo "$alert" >> "$ALERTS_LOG"

    if [[ "$STORE_ALERTS_DB" == "1" ]]; then
      insert_db_alert "$line" "$alert_type" "$severity"
    fi
  fi
done
