param(
  [string]$AttackUrl = "http://localhost:8081",
  [string]$SafeUrl = "https://localhost:8443"
)

$ErrorActionPreference = "Continue"

function Invoke-LabRequest {
  param(
    [string]$Label,
    [string]$Method = "GET",
    [string]$Url,
    [switch]$Insecure,
    [switch]$PathAsIs
  )

  Write-Host ""
  Write-Host "==> $Label"

  $args = @("-sS", "-o", "NUL", "-w", "HTTP %{http_code}`n", "-X", $Method)
  if ($Insecure) {
    $args = @("-k") + $args
  }
  if ($PathAsIs) {
    $args = @("--path-as-is") + $args
  }
  $args += $Url

  & curl.exe @args
}

Write-Host "Generating harmless Secure Proxy Lab traffic"
Write-Host "Attack proxy: $AttackUrl"
Write-Host "Safe proxy: $SafeUrl"

Invoke-LabRequest "Attack proxy: GET /" -Url "$AttackUrl/"
Invoke-LabRequest "Attack proxy: GET /.env" -Url "$AttackUrl/.env"
Invoke-LabRequest "Attack proxy: GET /.git/config" -Url "$AttackUrl/.git/config"
Invoke-LabRequest "Attack proxy: GET /backup.sql" -Url "$AttackUrl/backup.sql"
Invoke-LabRequest "Attack proxy: GET /backup.zip" -Url "$AttackUrl/backup.zip"
Invoke-LabRequest "Attack proxy: SQL injection-looking search" -Url "$AttackUrl/search?q=UNION%20SELECT%20username,password%20FROM%20users"
Invoke-LabRequest "Attack proxy: XSS-looking search" -Url "$AttackUrl/search?q=%3Cscript%3Ealert(1)%3C/script%3E"
Invoke-LabRequest "Attack proxy: exposed demo passwd file" -Url "$AttackUrl/etc/passwd"

Write-Host ""
Write-Host "==> Attack proxy: repeated POST /login"
for ($i = 1; $i -le 50; $i++) {
  Write-Host -NoNewline "login attempt ${i}: "
  & curl.exe -sS -o NUL -w "HTTP %{http_code}`n" -X POST "$AttackUrl/login"
}

Invoke-LabRequest "Safe proxy: GET /" -Url "$SafeUrl/" -Insecure
Invoke-LabRequest "Safe proxy: GET /.env should be blocked" -Url "$SafeUrl/.env" -Insecure
Invoke-LabRequest "Safe proxy: GET /.git/config should be blocked" -Url "$SafeUrl/.git/config" -Insecure
Invoke-LabRequest "Safe proxy: GET /backup.sql should be blocked" -Url "$SafeUrl/backup.sql" -Insecure
Invoke-LabRequest "Safe proxy: GET /backup.zip should be blocked" -Url "$SafeUrl/backup.zip" -Insecure
Invoke-LabRequest "Safe proxy: SQL injection-looking search still reaches app as normal traffic" -Url "$SafeUrl/search?q=UNION%20SELECT%20username,password%20FROM%20users" -Insecure
Invoke-LabRequest "Safe proxy: XSS-looking search still reaches app as normal traffic" -Url "$SafeUrl/search?q=%3Cscript%3Ealert(1)%3C/script%3E" -Insecure
Invoke-LabRequest "Safe proxy: demo passwd file should be blocked" -Url "$SafeUrl/etc/passwd" -Insecure

Write-Host ""
Write-Host "==> Safe proxy: repeated POST /login"
for ($i = 1; $i -le 50; $i++) {
  Write-Host -NoNewline "safe login attempt ${i}: "
  & curl.exe -k -sS -o NUL -w "HTTP %{http_code}`n" -X POST "$SafeUrl/login"
}

Write-Host ""
Write-Host "Done. Logs should now be available under logs/attack and logs/safe."
