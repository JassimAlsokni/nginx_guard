# Secure Proxy Lab

## Project Objective

This project demonstrates how Nginx can work as a reverse proxy in front of a web app. It compares an insecure proxy with a secure proxy.

The main security goals are:

- Use Nginx as a reverse proxy
- Enforce TLS 1.3 on the safe proxy
- Add custom security headers
- Block sensitive file paths on the safe proxy
- Store request history in Nginx logs
- Analyze and monitor logs without needing a database

## Architecture

```text
User / Attacker
    |
    |-- http://localhost:8081
    |       |
    |       v
    |   Attack Nginx Proxy (nginx-attack)
    |       |
    |       v
    |   Internal Frontend App
    |
    |-- http://localhost:8082
    |       |
    |       v
    |   Redirect to HTTPS
    |
    |-- https://localhost:8443
            |
            v
        Safe Nginx Proxy (nginx-safe)
            |
            v
        Internal Frontend App
```

Both Nginx proxies send valid traffic to the same internal frontend app. The difference is the Nginx configuration.

## What Is a Reverse Proxy?

A reverse proxy receives requests from users and forwards them to an internal application.

In this lab, users do not directly access the frontend app container. They access Nginx first. Nginx then decides what to do with the request.

## Attack Proxy

Attack proxy (`nginx-attack`) runs at:

```text
http://localhost:8081
```

It is intentionally weak:

- HTTP only
- No TLS
- No HSTS
- No Content-Security-Policy
- No X-Frame-Options
- No sensitive path blocking
- Logs all requests to `logs/attack/access.log`
- Logs errors to `logs/attack/error.log`

This proxy is useful because suspicious requests are allowed through and can be studied in the logs.

## Safe Proxy

Safe proxy (`nginx-safe`) runs at:

```text
https://localhost:8443
```

The HTTP redirect runs at:

```text
http://localhost:8082
```

The safe proxy:

- Uses HTTPS
- Allows TLS 1.3 only
- Redirects HTTP to HTTPS
- Adds security headers
- Blocks sensitive paths
- Logs all requests to `logs/safe/access.log`
- Logs errors to `logs/safe/error.log`

Blocked paths include:

```text
/.env
/.git
*.sql
*.bak
*.zip
/backup*
/config*
```

## TLS 1.3

TLS protects traffic between the browser and the safe proxy.

The TLS 1.3 Nginx config uses:

```nginx
ssl_protocols TLSv1.3;
```

This means old TLS versions should fail.

Test TLS 1.3:

```bash
openssl s_client -connect localhost:8443 -tls1_3
```

Test TLS 1.2 rejection:

```bash
openssl s_client -connect localhost:8443 -tls1_2
```

## Security Headers

The safe proxy adds these headers.

### HSTS

`Strict-Transport-Security` tells the browser to use HTTPS in the future.

### CSP

`Content-Security-Policy` controls what scripts, images, frames, and other resources are allowed.

### X-Frame-Options

`X-Frame-Options: DENY` helps stop clickjacking by blocking iframe embedding.

### X-Content-Type-Options

`X-Content-Type-Options: nosniff` tells the browser not to guess file types.

### Referrer-Policy

`Referrer-Policy` controls how much referrer information is sent to other sites.

### Permissions-Policy

`Permissions-Policy` disables browser features that the app does not need.

Test headers:

```bash
curl -kI https://localhost:8443
```

## Log Storage

Nginx logs are mounted to the host project folder:

```text
logs/
  attack/
    access.log
    error.log
  safe/
    access.log
    error.log
  alerts.log
```

The logs are the main data source for this project.

Docker logging rotation is enabled in `docker-compose.yml` so Docker container logs do not grow forever.

## Nginx Log Format

The project uses a custom log format named `security`.

It includes:

- Remote IP
- Timestamp
- Request method, path, and protocol
- Status code
- Response size
- Referrer
- User-Agent
- Request time
- Upstream response time

## Generate Demo Traffic

Run:

```bash
scripts/generate-lab-traffic.sh
```

This sends harmless demo requests to both proxies. It includes paths like:

```text
/.env
/.git/config
/backup.sql
/backup.zip
/search?q=UNION SELECT username,password FROM users
/search?q=<script>alert(1)</script>
/../../etc/passwd
50 POST /login requests
```

## Historical Log Analysis

Run:

```bash
scripts/analyze-nginx-logs.sh logs/attack/access.log logs/attack/error.log
```

The script checks for:

- Sensitive file access
- Suspicious 200 or 302 responses
- SQL injection patterns
- XSS patterns
- Directory traversal
- Brute-force style login attempts
- Error or crash indicators

Important note:

```text
200/302 on suspicious paths may indicate a potentially successful suspicious request and should be investigated.
```

A 200 response does not always prove full compromise.

## Real-Time Monitoring

Run:

```bash
scripts/monitor-nginx-logs.sh logs/attack/access.log
```

When a suspicious request appears, the script prints an alert and appends it to:

```text
logs/alerts.log
```

Example:

```text
[ALERT] 2026-05-24 20:30:10 Suspicious request detected: <original log line>
```

## Optional PostgreSQL Alerts

No database is required for the basic lab. Nginx logs are enough for request history and analysis.

PostgreSQL is included only as an optional enhancement. It stores detected alerts, not raw logs.

Start the optional database:

```bash
docker compose --profile alerts-db up -d alerts-db
```

Run the monitor with database storage enabled:

```bash
STORE_ALERTS_DB=1 scripts/monitor-nginx-logs.sh logs/attack/access.log
```

The monitor creates this table:

```sql
CREATE TABLE security_alerts (
  id SERIAL PRIMARY KEY,
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  source_ip TEXT,
  request_line TEXT,
  status_code INT,
  alert_type TEXT,
  severity TEXT,
  raw_log TEXT
);
```

## App Log Page

The React app includes a **Nginx Logs** page.

Start the local app and lab API:

```bash
npm run lab
```

Open:

```text
http://localhost:5175/logs
```

This page reads the real files in the `logs/` folder through the local lab API.

## Commands to Run the Project

Install dependencies:

```bash
npm install
```

Start the React app and local lab API:

```bash
npm run lab
```

Start Docker lab:

```bash
docker compose up --build
```

Generate traffic:

```bash
scripts/generate-lab-traffic.sh
```

Analyze logs:

```bash
scripts/analyze-nginx-logs.sh logs/attack/access.log logs/attack/error.log
```

Monitor logs:

```bash
scripts/monitor-nginx-logs.sh logs/attack/access.log
```

## Final Conclusion

This lab shows how a reverse proxy can improve web security without changing the frontend app.

The attack proxy shows weak behavior. The safe proxy shows stronger behavior with TLS 1.3, security headers, path blocking, and useful logs.

The main evidence is stored in Nginx access and error logs. PostgreSQL is optional and only stores detected alerts for later review.
