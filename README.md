# EC520 Secure Proxy Lab

A standalone Vite + React app for demonstrating Nginx reverse proxy security, TLS 1.3, security headers, and log-based monitoring.

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
docker compose up --build
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

Test TLS 1.3:

```bash
openssl s_client -connect localhost:8443 -tls1_3
```

Test TLS 1.2 rejection:

```bash
openssl s_client -connect localhost:8443 -tls1_2
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
