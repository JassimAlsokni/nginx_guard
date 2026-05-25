import fs from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import tls from "node:tls";

const host = process.env.LAB_API_HOST || "127.0.0.1";
const port = Number(process.env.LAB_API_PORT || 4000);
const rootDir = process.cwd();
const logsDir = path.join(rootDir, "logs");

const targets = {
  attack: {
    label: "Attack Proxy",
    protocol: "http:",
    hostname: process.env.ATTACK_PROXY_HOST || "localhost",
    port: Number(process.env.ATTACK_PROXY_PORT || 8081),
    baseUrl: "http://localhost:8081",
  },
  safe: {
    label: "Safe Proxy",
    protocol: "https:",
    hostname: process.env.SAFE_PROXY_HOST || "localhost",
    port: Number(process.env.SAFE_PROXY_PORT || 8443),
    baseUrl: "https://localhost:8443",
  },
};

const targetAliases = {
  attack: "attack",
  vulnerable: "attack",
  safe: "safe",
  secure: "safe",
  hardened: "safe",
};

const tests = {
  sqli: {
    path: "/search?q=UNION%20SELECT%20username,password%20FROM%20users",
    command: {
      attack: "curl -s 'http://localhost:8081/search?q=UNION%20SELECT%20username,password%20FROM%20users'",
      safe: "curl -k -s 'https://localhost:8443/search?q=UNION%20SELECT%20username,password%20FROM%20users'",
    },
  },
  xss: {
    path: "/search?q=%3Cscript%3Ealert(1)%3C/script%3E",
    command: {
      attack: "curl -s 'http://localhost:8081/search?q=<script>alert(1)</script>'",
      safe: "curl -k -s 'https://localhost:8443/search?q=<script>alert(1)</script>'",
    },
  },
  "path-traversal": {
    path: "/search?q=..%2f..%2fetc%2fpasswd",
    command: {
      attack: "curl -s 'http://localhost:8081/search?q=..%2f..%2fetc%2fpasswd'",
      safe: "curl -k -s 'https://localhost:8443/search?q=..%2f..%2fetc%2fpasswd'",
    },
  },
  dotfiles: {
    path: "/.env",
    command: {
      attack: "curl -s http://localhost:8081/.env",
      safe: "curl -k -s https://localhost:8443/.env",
    },
  },
  clickjacking: {
    path: "/",
    command: {
      attack: "curl -s -D - http://localhost:8081 -o /dev/null | grep -i frame",
      safe: "curl -k -s -D - https://localhost:8443 -o /dev/null | grep -i frame",
    },
  },
  headers: {
    path: "/",
    command: {
      attack: "curl -s -D - http://localhost:8081 -o /dev/null",
      safe: "curl -k -s -D - https://localhost:8443 -o /dev/null",
    },
  },
};

const logFiles = {
  "attack-access": path.join(logsDir, "attack", "access.log"),
  "attack-error": path.join(logsDir, "attack", "error.log"),
  "safe-access": path.join(logsDir, "safe", "access.log"),
  "safe-error": path.join(logsDir, "safe", "error.log"),
  alerts: path.join(logsDir, "alerts.log"),
};

const headerAudit = [
  "strict-transport-security",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
];

const shownHeaders = [
  "server",
  "content-type",
  "strict-transport-security",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "location",
];

const detectors = [
  { type: "Sensitive File Access", severity: "High", pattern: /(\/.env(?:[/?#]|$)|\/.git(?:[/?#]|$)|\.sql(?:[/?#]|$)|\.bak(?:[/?#]|$)|\.zip(?:[/?#]|$)|\/backup[/?#]|\/config[/?#])/i },
  { type: "SQL Injection Pattern", severity: "High", pattern: /\bunion\s+select\b|\bselect\s+.{0,50}?\s+from\b|\bor\s+1\s*=\s*1|information_schema/i },
  { type: "XSS Pattern", severity: "Medium", pattern: /(<script>|javascript:|onerror=|onload=)/i },
  { type: "Directory Traversal", severity: "High", pattern: /(\.\.\/|\.\.%2f|%2e%2e)/i },
  { type: "Admin Path Probe", severity: "Medium", pattern: /\/admin/i },
  { type: "Login Attempt", severity: "Low", pattern: /"POST \/login/i },
];

const errorIndicators = /(segfault|worker process exited|upstream timed out|connect\(\) failed|no live upstreams)/i;

async function ensureLogFiles() {
  await fs.mkdir(path.join(logsDir, "attack"), { recursive: true });
  await fs.mkdir(path.join(logsDir, "safe"), { recursive: true });

  await Promise.all(
    Object.values(logFiles).map(async (filePath) => {
      try {
        await fs.access(filePath);
      } catch {
        await fs.writeFile(filePath, "");
      }
    })
  );
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4096) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON request body"));
      }
    });

    req.on("error", reject);
  });
}

async function readLines(filePath, limit = 200) {
  let content = "";
  try {
    content = await fs.readFile(filePath, "utf8");
  } catch {
    return [];
  }

  const lines = content.split(/\r?\n/).filter(Boolean);
  return lines.slice(Math.max(0, lines.length - limit));
}

function requestTarget(target, requestPath, options = {}) {
  const client = target.protocol === "https:" ? https : http;
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const req = client.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        path: requestPath,
        method: options.method || "GET",
        rejectUnauthorized: false,
        headers: {
          "User-Agent": "EC520-Local-Lab-Runner/1.0",
          Accept: "*/*",
        },
      },
      (response) => {
        let body = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
          if (body.length > 4000) {
            response.destroy();
          }
        });
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode,
            statusMessage: response.statusMessage,
            headers: response.headers,
            body,
            durationMs: Date.now() - startedAt,
          });
        });
      }
    );

    req.setTimeout(8000, () => {
      req.destroy(new Error("request timed out after 8000ms"));
    });

    req.on("error", (error) => {
      resolve({
        error: error.message,
        code: error.code,
        durationMs: Date.now() - startedAt,
      });
    });

    req.end();
  });
}

function tlsProbe({ hostname, port, minVersion, maxVersion }) {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const socket = tls.connect({
      host: hostname,
      port,
      servername: hostname,
      rejectUnauthorized: false,
      minVersion,
      maxVersion,
    });

    socket.setTimeout(8000, () => {
      socket.destroy(new Error("TLS probe timed out after 8000ms"));
    });

    socket.once("secureConnect", () => {
      const cipher = socket.getCipher();
      resolve({
        ok: true,
        protocol: socket.getProtocol(),
        cipher: cipher?.name || "unknown",
        durationMs: Date.now() - startedAt,
      });
      socket.end();
    });

    socket.once("error", (error) => {
      resolve({
        ok: false,
        error: error.message,
        code: error.code,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

function headerValue(value) {
  return Array.isArray(value) ? value.join(", ") : value;
}

function connectionErrorOutput(target, result) {
  return [
    `ERROR: ${target.label} did not answer`,
    `Target: ${target.baseUrl}`,
    `Reason: ${result.code || "ERR"} ${result.error || "unknown error"}`,
    "",
    "Start the Docker lab first:",
    "docker compose up --build",
  ].join("\n");
}

function previewBody(body) {
  const text = String(body || "").trim();
  if (!text) {
    return "(empty body)";
  }

  const isHtml = /<!doctype html|<html[\s>]/i.test(text);
  if (isHtml) {
    return text.length > 3500 ? `${text.slice(0, 3500)}\n<!-- body truncated -->\n</body>\n</html>` : text;
  }

  return text.length > 1200 ? `${text.slice(0, 1200)}\n... body truncated ...` : text;
}

function summarizeHttp(testId, targetName, result) {
  const status = result.statusCode;
  const headers = result.headers || {};

  if (targetName === "safe") {
    if (testId === "dotfiles") {
      return status === 403 ? "PASS: Safe proxy blocked a sensitive path before the app." : "WARN: Sensitive path was not blocked.";
    }
    if (testId === "headers") {
      return `PASS: ${headerAudit.filter((header) => headers[header]).length}/6 required security headers are present.`;
    }
    if (testId === "clickjacking") {
      return headers["x-frame-options"] ? "PASS: X-Frame-Options is present." : "WARN: X-Frame-Options is missing.";
    }
  }

  if (targetName === "attack") {
    if (testId === "headers") {
      return `WARN: ${headerAudit.filter((header) => !headers[header]).length}/6 required security headers are missing.`;
    }
    if (testId === "dotfiles" && (status === 200 || status === 302)) {
      return "WARN: 200/302 on suspicious paths may indicate a potentially successful suspicious request and should be investigated.";
    }
  }

  return "INFO: Real request completed and was written to Nginx access.log.";
}

function formatHttpOutput(testId, targetName, result) {
  const target = targets[targetName];

  if (result.error || result.code) {
    return connectionErrorOutput(target, result);
  }

  const lines = [
    `HTTP/1.1 ${result.statusCode} ${result.statusMessage || ""}`.trim(),
    `Target: ${target.baseUrl}`,
    `Duration: ${result.durationMs}ms`,
  ];

  for (const header of shownHeaders) {
    const value = headerValue(result.headers?.[header]);
    if (value) {
      lines.push(`${header}: ${value}`);
    }
  }

  if (testId === "headers") {
    lines.push("", "Header audit:");
    for (const header of headerAudit) {
      lines.push(`- ${header}: ${result.headers?.[header] ? "present" : "missing"}`);
    }
  }

  lines.push("", previewBody(result.body), "", summarizeHttp(testId, targetName, result));
  return lines.join("\n");
}

function withCommand(command, output) {
  return [`$ ${command}`, "", output].join("\n");
}

async function runHttpTest(testId, targetName) {
  const test = tests[testId];
  const target = targets[targetName];
  const result = await requestTarget(target, test.path);

  return {
    command: test.command[targetName],
    output: withCommand(test.command[targetName], formatHttpOutput(testId, targetName, result)),
  };
}

async function runRateLimitTest(targetName) {
  const target = targets[targetName];
  const command =
    targetName === "safe"
      ? 'for i in {1..12}; do curl -k -s -o /dev/null -w "req $i: %{http_code}\\n" -X POST https://localhost:8443/login; done'
      : 'for i in {1..12}; do curl -s -o /dev/null -w "req $i: %{http_code}\\n" -X POST http://localhost:8081/login; done';

  const results = [];
  for (let i = 1; i <= 12; i++) {
    const result = await requestTarget(target, "/login", { method: "POST" });
    results.push({ index: i, result });
  }

  const lines = [`Target: ${target.baseUrl}/login`, "Real POST /login requests: 12", ""];
  for (const item of results) {
    lines.push(`req ${item.index}: ${item.result.error ? item.result.code || "ERR" : item.result.statusCode}`);
  }
  lines.push("", "INFO: These attempts are written to access.log for brute-force style analysis.");

  return { command, output: withCommand(command, lines.join("\n")) };
}

async function runTlsTest(targetName) {
  if (targetName === "attack") {
    const httpResult = await requestTarget(targets.attack, "/");
    const command = "curl -I http://localhost:8081";
    return {
      command,
      output: httpResult.error
        ? withCommand(command, connectionErrorOutput(targets.attack, httpResult))
        : withCommand(command, `HTTP status: ${httpResult.statusCode}\nWARN: Attack proxy is reachable over plaintext HTTP only.`),
    };
  }

  const safeTarget = targets.safe;
  const tls13 = await tlsProbe({
    hostname: safeTarget.hostname,
    port: safeTarget.port,
    minVersion: "TLSv1.3",
    maxVersion: "TLSv1.3",
  });

  const command = "openssl s_client -connect localhost:8443 -tls1_3";
  if (tls13.code === "ECONNREFUSED") {
    return {
      command,
      output: withCommand(command, connectionErrorOutput(targets.safe, tls13)),
    };
  }

  const tls12 = await tlsProbe({
    hostname: safeTarget.hostname,
    port: safeTarget.port,
    minVersion: "TLSv1.2",
    maxVersion: "TLSv1.2",
  });

  return {
    command,
    output: withCommand(command, [
      "TLS 1.3 probe: localhost:8443",
      tls13.ok
        ? `PASS: connected with protocol=${tls13.protocol} cipher=${tls13.cipher} duration=${tls13.durationMs}ms`
        : `ERROR: TLS 1.3 failed: ${tls13.code || "ERR"} ${tls13.error}`,
      "",
      "TLS 1.2 rejection probe: localhost:8443",
      tls12.ok
        ? `WARN: TLS 1.2 was accepted with protocol=${tls12.protocol}`
        : `PASS: TLS 1.2 was rejected: ${tls12.code || "ERR"} ${tls12.error}`,
    ].join("\n")),
  };
}

async function runTest(testId, rawTargetName) {
  const targetName = targetAliases[rawTargetName];

  if (!targetName) {
    throw new Error("Unknown target. Allowed values: attack, safe.");
  }

  if (testId === "ratelimit") {
    return runRateLimitTest(targetName);
  }

  if (testId === "tls") {
    return runTlsTest(targetName);
  }

  if (!tests[testId]) {
    throw new Error("Unknown test id.");
  }

  return runHttpTest(testId, targetName);
}

function parseStatus(line) {
  const match = line.match(/" (\d{3}) /);
  return match ? Number(match[1]) : null;
}

function parseRequest(line) {
  const match = line.match(/"([^"]+)"/);
  return match ? match[1] : "";
}

function detectLine(line) {
  const matches = detectors.filter((detector) => detector.pattern.test(line));
  return matches.map((match) => ({
    type: match.type,
    severity: match.severity,
    status: parseStatus(line),
    request: parseRequest(line),
    raw: line,
  }));
}

function statusCounts(lines) {
  const counts = {};
  for (const line of lines) {
    const status = parseStatus(line);
    if (status) {
      counts[status] = (counts[status] || 0) + 1;
    }
  }
  return counts;
}

async function buildLogSummary() {
  const attackAccess = await readLines(logFiles["attack-access"], 5000);
  const safeAccess = await readLines(logFiles["safe-access"], 5000);
  const attackError = await readLines(logFiles["attack-error"], 500);
  const safeError = await readLines(logFiles["safe-error"], 500);
  const alerts = await readLines(logFiles.alerts, 100);
  const attackFindings = attackAccess.flatMap(detectLine);
  const safeFindings = safeAccess.flatMap(detectLine);
  const errorFindings = [...attackError, ...safeError].filter((line) => errorIndicators.test(line));

  return {
    attack: {
      totalRequests: attackAccess.length,
      suspiciousRequests: attackFindings.length,
      statusCounts: statusCounts(attackAccess),
      latest: attackAccess.slice(-20).reverse(),
    },
    safe: {
      totalRequests: safeAccess.length,
      suspiciousRequests: safeFindings.length,
      blockedRequests: safeAccess.filter((line) => parseStatus(line) === 403 || parseStatus(line) === 404).length,
      statusCounts: statusCounts(safeAccess),
      latest: safeAccess.slice(-20).reverse(),
    },
    errors: {
      indicators: errorFindings.slice(-20).reverse(),
    },
    alerts: alerts.slice(-50).reverse(),
    findings: [...attackFindings, ...safeFindings].slice(-100).reverse(),
  };
}

async function handleGetLogs(url, res) {
  const source = url.searchParams.get("source") || "attack";
  const type = url.searchParams.get("type") || "access";
  const limit = Math.min(Number(url.searchParams.get("limit") || 200), 1000);
  const key = source === "alerts" ? "alerts" : `${source}-${type}`;

  if (!logFiles[key]) {
    sendJson(res, 400, { ok: false, error: "Unknown log source/type." });
    return;
  }

  const lines = await readLines(logFiles[key], limit);
  sendJson(res, 200, { ok: true, key, lines: lines.reverse() });
}

async function route(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/lab/health") {
    sendJson(res, 200, { ok: true, service: "ec520-lab-api" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/lab/logs") {
    await handleGetLogs(url, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/lab/log-summary") {
    sendJson(res, 200, { ok: true, summary: await buildLogSummary() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/lab/run") {
    const body = await readJson(req);
    const result = await runTest(String(body.testId || ""), String(body.target || ""));

    sendJson(res, 200, {
      ok: true,
      testId: body.testId,
      target: targetAliases[String(body.target || "")],
      command: result.command,
      output: result.output,
      executedAt: new Date().toISOString(),
    });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
}

await ensureLogFiles();

const server = http.createServer((req, res) => {
  route(req, res).catch((error) => {
    sendJson(res, 400, { ok: false, error: error.message });
  });
});

server.listen(port, host, () => {
  console.log(`EC520 lab API listening on http://${host}:${port}`);
});
