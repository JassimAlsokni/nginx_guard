param(
  [Parameter(Mandatory = $true)][string]$AccessLog,
  [Parameter(Mandatory = $true)][string]$ErrorLog
)

if (-not (Test-Path -LiteralPath $AccessLog)) {
  Write-Error "Access log not found: $AccessLog"
  exit 1
}

if (-not (Test-Path -LiteralPath $ErrorLog)) {
  Write-Error "Error log not found: $ErrorLog"
  exit 1
}

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host "============================================================"
  Write-Host $Title
  Write-Host "============================================================"
}

function Show-Matches {
  param(
    [string]$Pattern,
    [string]$File
  )

  $matches = Select-String -LiteralPath $File -Pattern $Pattern -AllMatches
  if ($matches) {
    $matches | ForEach-Object { $_.Line }
  } else {
    Write-Host "No matches found."
  }
}

$sensitive = '(\.env|\.git|\.sql|\.bak|\.zip|backup|config)'
$sqli = '(union\s+select|select.+from|or\s+1=1|information_schema)'
$xss = '(<script>|%3cscript%3e|javascript:|onerror=|onload=)'
$traversal = '(\.\./|\.\.%2f|%2e%2e|/etc/passwd)'
$errors = '(segfault|worker process exited|upstream timed out|connect\(\) failed|no live upstreams)'

Write-Host "Nginx Security Log Analysis"
Write-Host "Access log: $AccessLog"
Write-Host "Error log:  $ErrorLog"
Write-Host ""
Write-Host "Note: 200/302 on suspicious paths may indicate a potentially successful suspicious request and should be investigated."

Write-Section "A. Sensitive File Access"
Show-Matches $sensitive $AccessLog

Write-Section "B. Suspicious Successful Sensitive Requests"
$successful = Get-Content -LiteralPath $AccessLog | Where-Object {
  $request = [regex]::Match($_, '"[^"]+"').Value
  $request -match $sensitive -and ($_ -match '" 200 ' -or $_ -match '" 302 ')
}
if ($successful) {
  $successful
} else {
  Write-Host "No matches found."
}

Write-Section "C. SQL Injection Patterns"
Show-Matches $sqli $AccessLog

Write-Section "D. XSS Patterns"
Show-Matches $xss $AccessLog

Write-Section "E. Directory Traversal"
Show-Matches $traversal $AccessLog

Write-Section "F. Brute-Force Style Login Attempts"
$counts = @{}
Get-Content -LiteralPath $AccessLog | Where-Object { $_ -match '"POST /login' } | ForEach-Object {
  $ip = ($_ -split '\s+')[0]
  if (-not $counts.ContainsKey($ip)) {
    $counts[$ip] = 0
  }
  $counts[$ip]++
}
$found = $false
foreach ($ip in $counts.Keys) {
  if ($counts[$ip] -ge 5) {
    Write-Host "$ip POST /login attempts: $($counts[$ip])"
    $found = $true
  }
}
if (-not $found) {
  Write-Host "No IPs with many login attempts found."
}

Write-Section "G. Error/Crash Indicators"
Show-Matches $errors $ErrorLog

Write-Host ""
Write-Host "Analysis complete."
