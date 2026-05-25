# EC520 Secure Proxy Lab

A standalone Vite + React app for demonstrating Nginx reverse proxy security, TLS 1.3, security headers, and log-based monitoring.

## Project Goal

This lab compares two Nginx reverse proxy configurations:

```text
Attack proxy: intentionally insecure HTTP proxy
Safe proxy: HTTPS proxy with TLS 1.3, security headers, and path blocking
```

Both proxies send traffic to the same internal `frontend-app` container. This makes the security difference clear: the app is the same, but the Nginx configuration is different.

## Docker Architecture

```text
User
 ├── http://localhost:8081
 │       └── nginx-attack
 │              └── frontend-app
 │
 ├── http://localhost:8082
 │       └── nginx-safe redirects to HTTPS
 │
 └── https://localhost:8443
         └── nginx-safe
                └── frontend-app

React Run buttons / Logs page
         └── lab-api
                └── logs/
```

Containers:

```text
frontend-app  Serves the React app and harmless demo files.
lab-api       Supports Run buttons, log summaries, and log viewing.
nginx-attack  Insecure reverse proxy on http://localhost:8081.
nginx-safe    Secure reverse proxy on https://localhost:8443 and redirect port 8082.
```

## Important Config Files

```text
docker-compose.yml
```

Starts the full lab and exposes the required ports:

```text
8081 -> attack proxy HTTP
8082 -> safe proxy HTTP redirect
8443 -> safe proxy HTTPS
4000 -> lab API
```

```text
nginx/attack.conf
```

Insecure proxy configuration. It is HTTP only, has no TLS, no security headers, and does not block sensitive demo files.

```text
nginx/safe.conf
```

Secure proxy configuration. It enforces:

```text
ssl_protocols TLSv1.3;
HSTS
CSP
X-Frame-Options
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
Sensitive path blocking
HTTP to HTTPS redirect
```

```text
nginx/frontend.conf
```

Internal app server configuration. It serves the React app and harmless demo files such as:

```text
/.env
/.git/config
/backup.sql
/backup.zip
/etc/passwd
```

These are demo training files, not real system secrets.

```text
lab-api/server.js
```

Local helper API used by the React platform. It lets the UI run real checks against the Docker proxies and read Nginx logs.

## Run the React app locally

```bash
npm install
npm run lab
```

Then open:

```text
http://localhost:5175
```

## Secure Proxy Lab Commands

```bash
docker compose up --build -d
```

Attack proxy (`nginx-attack`):

```text
http://localhost:8081
```

Safe proxy (`nginx-safe`):

```text
https://localhost:8443
```

Secure HTTP redirect:

```text
http://localhost:8082
```

Test headers:

```bash
curl -kI https://localhost:8443
```

Expected result includes:

```text
Strict-Transport-Security
Content-Security-Policy
X-Frame-Options
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
```

Test TLS 1.3:

```bash
openssl s_client -connect localhost:8443 -tls1_3
```

Expected result includes:

```text
Protocol version: TLSv1.3
```

Test TLS 1.2 rejection:

```bash
openssl s_client -connect localhost:8443 -tls1_2
```

Expected result includes:

```text
tlsv1 alert protocol version
```

This means TLS 1.2 was rejected.

Test attack vs safe sensitive paths:

```powershell
curl.exe http://localhost:8081/.env
curl.exe -kI https://localhost:8443/.env
curl.exe http://localhost:8081/etc/passwd
curl.exe -kI https://localhost:8443/etc/passwd
```

Expected result:

```text
Attack proxy returns 200 and demo content.
Safe proxy returns 403 Forbidden.
```

Generate demo traffic:

```bash
scripts/generate-lab-traffic.sh
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate-lab-traffic.ps1
```

Analyze logs:

```bash
scripts/analyze-nginx-logs.sh logs/attack/access.log logs/attack/error.log
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/analyze-nginx-logs.ps1 logs/attack/access.log logs/attack/error.log
```

Monitor logs live:

```bash
scripts/monitor-nginx-logs.sh logs/attack/access.log
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/monitor-nginx-logs.ps1 logs/attack/access.log
```

## Validation Summary

Use these commands before presenting the project:

```powershell
npm run build
npm run typecheck
npm run lint
docker compose ps
docker compose exec -T nginx-safe nginx -t
docker compose exec -T nginx-attack nginx -t
curl.exe -I http://localhost:8081
curl.exe -kI https://localhost:8443
curl.exe -I http://localhost:8082
```

Expected high-level result:

```text
Build, typecheck, and lint pass.
Both Nginx configs are valid.
Attack proxy works on HTTP port 8081.
Safe proxy works on HTTPS port 8443.
HTTP port 8082 redirects to HTTPS.
Safe proxy returns security headers.
Safe proxy blocks sensitive paths with 403.
```

## Logs

Raw Nginx logs are stored on the host:

```text
logs/attack/access.log
logs/attack/error.log
logs/safe/access.log
logs/safe/error.log
logs/alerts.log
```

The app's **Nginx Logs** page reads these files through the local lab API started by `npm run lab`.

## No Database Required

The main source of security evidence is Nginx logs:

```text
access.log records requests, status codes, paths, user agents, and timing.
error.log records server-side errors.
alerts.log stores real-time monitor alerts.
```

PostgreSQL can be used as an optional extension for detected alerts, but the core lab does not require a database.

## Optional Alert Database

The main data source is still Nginx logs. PostgreSQL is optional and only stores detected alerts from the monitor script.

Start the optional database:

```bash
docker compose --profile alerts-db up -d alerts-db
```

Monitor and store alerts in both `logs/alerts.log` and PostgreSQL:

```bash
STORE_ALERTS_DB=1 scripts/monitor-nginx-logs.sh logs/attack/access.log
```
