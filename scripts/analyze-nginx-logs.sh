#!/usr/bin/env bash
set -euo pipefail

ACCESS_LOG="${1:-}"
ERROR_LOG="${2:-}"

if [[ -z "$ACCESS_LOG" || -z "$ERROR_LOG" ]]; then
  echo "Usage: scripts/analyze-nginx-logs.sh <access_log> <error_log>"
  exit 1
fi

if [[ ! -f "$ACCESS_LOG" ]]; then
  echo "Access log not found: $ACCESS_LOG"
  exit 1
fi

if [[ ! -f "$ERROR_LOG" ]]; then
  echo "Error log not found: $ERROR_LOG"
  exit 1
fi

section() {
  echo
  echo "============================================================"
  echo "$1"
  echo "============================================================"
}

print_matches() {
  local pattern="$1"
  local file="$2"
  if ! grep -E -i "$pattern" "$file"; then
    echo "No matches found."
  fi
}

SENSITIVE='(\.env|\.git|\.sql|\.bak|\.zip|backup|config)'
SQLI='(union[[:space:]]+select|select.+from|or[[:space:]]+1=1|information_schema)'
XSS='(<script>|%3cscript%3e|javascript:|onerror=|onload=)'
TRAVERSAL='(\.\./|\.\.%2f|%2e%2e|/etc/passwd)'
ERRORS='(segfault|worker process exited|upstream timed out|connect\(\) failed|no live upstreams)'

echo "Nginx Security Log Analysis"
echo "Access log: $ACCESS_LOG"
echo "Error log:  $ERROR_LOG"
echo
echo "Note: 200/302 on suspicious paths may indicate a potentially successful suspicious request and should be investigated."

section "A. Sensitive File Access"
print_matches "$SENSITIVE" "$ACCESS_LOG"

section "B. Suspicious Successful Sensitive Requests"
if ! awk '
  BEGIN { IGNORECASE=1 }
  {
    request = ""
    if (match($0, /"[^"]+"/)) {
      request = substr($0, RSTART, RLENGTH)
    }
    if (request ~ /(\.env|\.git|\.sql|\.bak|\.zip|backup|config)/ && ($0 ~ /" 200 / || $0 ~ /" 302 /)) {
      print
    }
  }
' "$ACCESS_LOG"; then
  echo "No matches found."
fi

section "C. SQL Injection Patterns"
print_matches "$SQLI" "$ACCESS_LOG"

section "D. XSS Patterns"
print_matches "$XSS" "$ACCESS_LOG"

section "E. Directory Traversal"
print_matches "$TRAVERSAL" "$ACCESS_LOG"

section "F. Brute-Force Style Login Attempts"
awk '
  /"POST \/login/ {
    count[$1]++
  }
  END {
    found = 0
    for (ip in count) {
      if (count[ip] >= 5) {
        printf "%s POST /login attempts: %d\n", ip, count[ip]
        found = 1
      }
    }
    if (!found) {
      print "No IPs with many login attempts found."
    }
  }
' "$ACCESS_LOG"

section "G. Error/Crash Indicators"
print_matches "$ERRORS" "$ERROR_LOG"

echo
echo "Analysis complete."
