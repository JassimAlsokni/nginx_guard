#!/usr/bin/env bash
set -euo pipefail

ATTACK_URL="${ATTACK_URL:-http://localhost:8081}"
SAFE_URL="${SAFE_URL:-https://localhost:8443}"

request() {
  local label="$1"
  shift
  echo
  echo "==> $label"
  "$@" || true
}

echo "Generating harmless Secure Proxy Lab traffic"
echo "Attack proxy: $ATTACK_URL"
echo "Safe proxy:   $SAFE_URL"

request "Attack proxy: GET /" \
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" "$ATTACK_URL/"

request "Attack proxy: GET /.env" \
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" "$ATTACK_URL/.env"

request "Attack proxy: GET /.git/config" \
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" "$ATTACK_URL/.git/config"

request "Attack proxy: GET /backup.sql" \
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" "$ATTACK_URL/backup.sql"

request "Attack proxy: GET /backup.zip" \
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" "$ATTACK_URL/backup.zip"

request "Attack proxy: SQL injection-looking search" \
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
    "$ATTACK_URL/search?q=UNION%20SELECT%20username,password%20FROM%20users"

request "Attack proxy: XSS-looking search" \
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
    "$ATTACK_URL/search?q=%3Cscript%3Ealert(1)%3C/script%3E"

request "Attack proxy: directory traversal-looking path" \
  curl -sS -o /dev/null -w "HTTP %{http_code}\n" "$ATTACK_URL/../../etc/passwd"

echo
echo "==> Attack proxy: repeated POST /login"
for i in $(seq 1 12); do
  curl -sS -o /dev/null -w "login attempt $i: HTTP %{http_code}\n" \
    -X POST "$ATTACK_URL/login" || true
done

request "Safe proxy: GET /" \
  curl -k -sS -o /dev/null -w "HTTP %{http_code}\n" "$SAFE_URL/"

request "Safe proxy: GET /.env should be blocked" \
  curl -k -sS -o /dev/null -w "HTTP %{http_code}\n" "$SAFE_URL/.env"

request "Safe proxy: GET /.git/config should be blocked" \
  curl -k -sS -o /dev/null -w "HTTP %{http_code}\n" "$SAFE_URL/.git/config"

request "Safe proxy: GET /backup.sql should be blocked" \
  curl -k -sS -o /dev/null -w "HTTP %{http_code}\n" "$SAFE_URL/backup.sql"

request "Safe proxy: GET /backup.zip should be blocked" \
  curl -k -sS -o /dev/null -w "HTTP %{http_code}\n" "$SAFE_URL/backup.zip"

request "Safe proxy: SQL injection-looking search still reaches app as normal traffic" \
  curl -k -sS -o /dev/null -w "HTTP %{http_code}\n" \
    "$SAFE_URL/search?q=UNION%20SELECT%20username,password%20FROM%20users"

request "Safe proxy: XSS-looking search still reaches app as normal traffic" \
  curl -k -sS -o /dev/null -w "HTTP %{http_code}\n" \
    "$SAFE_URL/search?q=%3Cscript%3Ealert(1)%3C/script%3E"

request "Safe proxy: directory traversal-looking path" \
  curl -k -sS -o /dev/null -w "HTTP %{http_code}\n" "$SAFE_URL/../../etc/passwd"

echo
echo "Done. Logs should now be available under logs/attack and logs/safe."
