#!/usr/bin/env bash
set -euo pipefail

ATTACK_URL="http://localhost:8081"
TLS13_URL="https://localhost:8443"
REDIRECT_URL="http://localhost:8082"
LOG_DIR="logs"

check_command() {
  local description="$1"
  local result="$2"

  if [[ "$result" == "0" ]]; then
    printf "[PASS] %s\n" "$description"
  else
    printf "[FAIL] %s\n" "$description"
    exit 1
  fi
}

echo "Checking course requirements..."

command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "openssl is required" >&2; exit 1; }

# 1. attack proxy reachable over HTTP
curl -sS -o /dev/null "$ATTACK_URL/"
check_command "Attack proxy HTTP reachable" $? 

# 2. safe proxy reachable over HTTPS
curl -k -sS -o /dev/null "$TLS13_URL/"
check_command "Safe proxy HTTPS reachable" $? 

# 3. redirect from port 8082
redirect_code=$(curl -sSI -o /dev/null -w "%{http_code} %{redirect_url}" "$REDIRECT_URL/")
if [[ "$redirect_code" =~ ^301 ]] || [[ "$redirect_code" =~ ^302 ]]; then
  echo "[PASS] HTTP redirect on 8082"
else
  echo "[FAIL] HTTP redirect on 8082"
  echo "  got: $redirect_code"
  exit 1
fi

# 4. TLS 1.3 enforcement
openssl s_client -connect localhost:8443 -tls1_3 </dev/null >/dev/null 2>&1
check_command "TLS 1.3 accepted" $? 

openssl s_client -connect localhost:8443 -tls1_2 </dev/null >/dev/null 2>&1
if [[ $? -ne 0 ]]; then
  check_command "TLS 1.2 rejected" 0
else
  echo "[FAIL] TLS 1.2 should be rejected on 8443"
  exit 1
fi

# 5. Security headers
headers_output=$(curl -k -sSI "$TLS13_URL/" )
if echo "$headers_output" | grep -qi "strict-transport-security:"; then
  echo "[PASS] HSTS header present"
else
  echo "[FAIL] HSTS header missing"
  exit 1
fi
if echo "$headers_output" | grep -qi "content-security-policy:"; then
  echo "[PASS] CSP header present"
else
  echo "[FAIL] CSP header missing"
  exit 1
fi
if echo "$headers_output" | grep -qi "x-frame-options:"; then
  echo "[PASS] X-Frame-Options header present"
else
  echo "[FAIL] X-Frame-Options header missing"
  exit 1
fi

# 6. Log files exist
for log_file in "$LOG_DIR/attack/access.log" "$LOG_DIR/attack/error.log" "$LOG_DIR/safe/access.log" "$LOG_DIR/safe/error.log" "$LOG_DIR/alerts.log"; do
  if [[ -f "$log_file" ]]; then
    echo "[PASS] Log file exists: $log_file"
  else
    echo "[FAIL] Log file missing: $log_file"
    exit 1
  fi
done

echo "All course requirement checks passed."
