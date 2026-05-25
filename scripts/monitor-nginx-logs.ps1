param(
  [Parameter(Mandatory = $true)][string]$AccessLog,
  [string]$AlertsLog = "logs/alerts.log"
)

$alertDir = Split-Path -Parent $AlertsLog
if ($alertDir) {
  New-Item -ItemType Directory -Force -Path $alertDir | Out-Null
}
if (-not (Test-Path -LiteralPath $AccessLog)) {
  New-Item -ItemType File -Force -Path $AccessLog | Out-Null
}
if (-not (Test-Path -LiteralPath $AlertsLog)) {
  New-Item -ItemType File -Force -Path $AlertsLog | Out-Null
}

$pattern = '(\.env|\.git|\.sql|\.bak|\.zip|backup|config|union\s+select|select.+from|<script>|%3cscript%3e|javascript:|\.\./|\.\.%2f|/etc/passwd|/admin|POST /login)'

Write-Host "Monitoring $AccessLog"
Write-Host "Alerts will be appended to $AlertsLog"
Write-Host "Press Ctrl+C to stop."

Get-Content -LiteralPath $AccessLog -Tail 0 -Wait | ForEach-Object {
  if ($_ -match $pattern) {
    $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $alert = "[ALERT] $now Suspicious request detected: $_"
    Write-Host $alert
    Add-Content -LiteralPath $AlertsLog -Value $alert
  }
}
