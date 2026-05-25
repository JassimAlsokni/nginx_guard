import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Play, Check, X, ChevronDown, ChevronUp, Copy, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const attacks = [
  {
    id: "sqli",
    name: "SQL Injection",
    severity: "critical",
    description: "Injects SQL syntax into query parameters to manipulate backend database queries.",
    payload: "/search?q=UNION%20SELECT%20username,password%20FROM%20users",
    fix: `location /search {
  if ($query_string ~* "(union|select|insert|drop|delete|update|--|;|'|\\\")") {
    return 403;
  }
}`,
  },
  {
    id: "xss",
    name: "Cross-Site Scripting (XSS)",
    severity: "high",
    description: "Sends a script payload through an input that might be reflected back to the browser.",
    payload: "/search?q=%3Cscript%3Ealert(1)%3C/script%3E",
    fix: `add_header Content-Security-Policy "default-src 'self'; script-src 'self';" always;
add_header X-Content-Type-Options "nosniff" always;`,
  },
  {
    id: "path-traversal",
    name: "Path Traversal / LFI",
    severity: "critical",
    description: "Attempts to escape the web root and access filesystem resources.",
    payload: "/../../etc/passwd",
    fix: `merge_slashes on;
location ~ /\.\./ {
  deny all;
}`,
  },
  {
    id: "dotfiles",
    name: "Hidden File Exposure",
    severity: "high",
    description: "Requests hidden files like .env and .git to expose secrets.",
    payload: "/.env",
    fix: `location ~ /\.(env|git) {
  deny all;
  access_log off;
  log_not_found off;
}`,
  },
  {
    id: "git-config",
    name: "Git Config Exposure",
    severity: "high",
    description: "Requests .git/config to reveal repository details or credentials.",
    payload: "/.git/config",
    fix: `location ~ /\.git/ {
  deny all;
  access_log off;
  log_not_found off;
}`,
  },
  {
    id: "backup-sql",
    name: "Backup File Exposure",
    severity: "high",
    description: "Requests backup files that may contain database dumps or credentials.",
    payload: "/backup.sql",
    fix: `location ~* \.(zip|sql|bak)$ {
  deny all;
  access_log off;
  log_not_found off;
}`,
  },
  {
    id: "backup-zip",
    name: "Backup Zip Exposure",
    severity: "high",
    description: "Requests archived backups that may include sensitive data.",
    payload: "/backup.zip",
    fix: `location ~* \.(zip|sql|bak)$ {
  deny all;
  access_log off;
  log_not_found off;
}`,
  },
  {
    id: "admin",
    name: "Admin Path Probe",
    severity: "medium",
    description: "Probes for administrative or hidden management endpoints.",
    payload: "/admin",
    fix: `location /admin {
  allow 127.0.0.1;
  deny all;
}`,
  },
  {
    id: "ratelimit",
    name: "Rate Limit Probe",
    severity: "medium",
    description: "Sends repeated requests to check whether rate limiting is enforced.",
    payload: "POST /login (50 requests)",
    fix: `limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /login {
  limit_req zone=api burst=20 nodelay;
}`,
  },
];

const requirementConfig = `server {
  listen 443 ssl http2;
  server_name example.com;

  ssl_protocols TLSv1.3;
  ssl_certificate /etc/nginx/ssl/fullchain.pem;
  ssl_certificate_key /etc/nginx/ssl/privkey.pem;
  ssl_session_tickets off;
  server_tokens off;

  add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; frame-ancestors 'none';" always;
  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin" always;
  add_header Permissions-Policy "geolocation=(), microphone=()" always;

  location / {
    proxy_pass http://frontend-app:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 80;
  server_name example.com;
  return 301 https://$server_name$request_uri;
}`;

const requirements = [
  { label: "Reverse Proxy", met: true, detail: "proxy_pass with forwarded client headers" },
  { label: "TLS 1.3 Only", met: true, detail: "ssl_protocols TLSv1.3 and no legacy TLS" },
  { label: "HSTS", met: true, detail: "Strict-Transport-Security with preload" },
  { label: "CSP", met: true, detail: "Content-Security-Policy blocks unsafe sources" },
  { label: "X-Frame-Options", met: true, detail: "DENY prevents clickjacking" },
  { label: "Secure Redirect", met: true, detail: "HTTP port 80 redirects to HTTPS" },
  { label: "Server Tokens Off", met: true, detail: "server_tokens off hides version info" },
];

function RequirementCard() {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-primary/30 bg-primary/5 overflow-hidden mb-6"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
              <ClipboardCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-sm font-semibold text-foreground">Assignment: Secure Proxy Configuration</h3>
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/10">✓ All Requirements Met</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Nginx reverse proxy · TLS 1.3 · HSTS · CSP · X-Frame-Options</p>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-primary/70 hover:text-primary flex items-center gap-1 flex-shrink-0 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? "Collapse" : "View"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-primary/20 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-primary/20">
              <div className="p-5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Requirement Checklist</h4>
                <div className="space-y-2.5">
                  {requirements.map((r) => (
                    <div key={r.label} className="flex items-start gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 text-primary" />
                      </div>
                      <div>
                        <span className="text-sm text-foreground font-medium">{r.label}</span>
                        <p className="text-xs text-muted-foreground font-mono">{r.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nginx Config</h4>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(requirementConfig);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="font-mono text-[11px] p-4 rounded-lg bg-card border border-border text-foreground/80 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                  {requirementConfig}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const severityColors = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

function AttackCard({ attack }) {
  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState("");

  const runAttack = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setExpanded(true);

    try {
      const response = await fetch("/api/lab/run-comparison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId: attack.id }),
      });

      const body = await response.json();
      if (!response.ok || !body.ok) {
        throw new Error(body.error || "Lab API request failed.");
      }

      setResult({
        attackProxy: body.attackProxy || body.attackHttp,
        safeProxy: body.safeProxy || body.tls13Proxy,
      });
    } catch (err) {
      setError(err?.message || "Unknown error");
    } finally {
      setRunning(false);
    }
  };

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  const renderResultColumn = (label, data, highlight) => (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-3">
        {highlight ? <X className="w-4 h-4 text-destructive" /> : <Check className="w-4 h-4 text-primary" />}
        <span className={`text-xs font-semibold uppercase tracking-wider ${highlight ? "text-destructive" : "text-primary"}`}>
          {label}
        </span>
        <Badge variant="outline" className={`text-[10px] ml-auto ${highlight ? "border-destructive/30 text-destructive" : "border-primary/30 text-primary"}`}>
          {data?.status || "--"}
        </Badge>
      </div>
      <div className="font-mono text-[11px] p-3 rounded-lg bg-secondary/50 border border-border text-foreground/80 mb-3 whitespace-pre-wrap max-h-52 overflow-y-auto">
        {data?.bodyPreview || "No response captured."}
      </div>
      <div className="space-y-1 text-[11px] text-muted-foreground">
        <div className="flex gap-2">
          <span className="font-semibold">Target:</span>
          <span className="font-mono">{data?.target || "--"}</span>
        </div>
        <div className="flex gap-2">
          <span className="font-semibold">Command:</span>
          <span className="font-mono break-all">{data?.command || "--"}</span>
        </div>
        {data?.error && (
          <div className="text-destructive">Error: {data.error}</div>
        )}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card overflow-hidden"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-base font-semibold text-foreground">{attack.name}</h3>
              <Badge variant="outline" className={`text-[10px] ${severityColors[attack.severity]}`}>
                {attack.severity}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{attack.description}</p>
          </div>
          <Button
            onClick={runAttack}
            disabled={running}
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 flex-shrink-0"
          >
            {running ? (
              <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            {running ? "Running..." : "Run Attack"}
          </Button>
        </div>

        <div className="font-mono text-xs px-3 py-2 rounded-lg bg-secondary/50 border border-border text-muted-foreground overflow-x-auto">
          {attack.payload}
        </div>
        {error && <p className="text-sm text-destructive mt-3">{error}</p>}
      </div>

      <AnimatePresence>
        {result && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
              {renderResultColumn("Attack Proxy", result.attackProxy, true)}
              {renderResultColumn("Safe Proxy", result.safeProxy, false)}
            </div>

            <div className="p-5 border-t border-border bg-secondary/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nginx Fix</span>
                <button
                  onClick={() => copyText(attack.fix, attack.id)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  {copied === attack.id ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="font-mono text-xs p-3 rounded-lg bg-card border border-border text-foreground/80 overflow-x-auto whitespace-pre-wrap">
                {attack.fix}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {result && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-2.5 text-xs text-muted-foreground hover:text-foreground border-t border-border transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Collapse" : "Show Results"}
        </button>
      )}
    </motion.div>
  );
}

export default function AttackSimulator() {
  return (
    <div className="min-h-screen p-6 lg:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">Attack Simulator</h1>
            </div>
            <p className="text-muted-foreground text-sm ml-[52px]">
              Fire real lab probes to compare the attack proxy with your TLS 1.3 secure proxy.
            </p>
          </div>
        </div>

        <RequirementCard />

        <div className="space-y-4">
          {attacks.map((attack) => (
            <AttackCard key={attack.id} attack={attack} />
          ))}
        </div>
      </div>
    </div>
  );
}
