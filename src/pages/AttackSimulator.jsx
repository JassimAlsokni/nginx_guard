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
    description: "Injects SQL code through query parameters to manipulate database queries.",
    payload: "?id=1' OR '1'='1' --",
    vulnerable: { status: 200, response: "SQL injection-looking request passed through and was logged for investigation.", headers: { "Server": "nginx/1.25.3" } },
    hardened: { status: 200, response: "Request reached the same frontend app, with safe proxy headers attached and logged.", headers: { "Server": "nginx", "Content-Security-Policy": "default-src 'self'", "X-Frame-Options": "DENY" } },
    fix: `# Block suspicious query strings\nif ($query_string ~* "(union|select|insert|drop|delete|update|--|;|'|\\\")" ) {\n  return 400;\n}`,
  },
  {
    id: "xss",
    name: "Cross-Site Scripting (XSS)",
    severity: "high",
    description: "Injects malicious JavaScript that executes in the victim's browser.",
    payload: '?search=<script>alert("XSS")</script>',
    vulnerable: { status: 200, response: "Script tag reflected in HTML response. Browser executes injected code.", headers: { "Server": "nginx/1.25.3" } },
    hardened: { status: 200, response: "Content-Security-Policy blocks inline script execution.", headers: { "Content-Security-Policy": "default-src 'self'; script-src 'self'", "X-Content-Type-Options": "nosniff" } },
    fix: `add_header Content-Security-Policy "default-src 'self'; script-src 'self';" always;\nadd_header X-Content-Type-Options "nosniff" always;`,
  },
  {
    id: "path-traversal",
    name: "Path Traversal / LFI",
    severity: "critical",
    description: "Uses ../ sequences to escape the web root and access system files.",
    payload: "/../../etc/passwd",
    vulnerable: { status: 200, response: "root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:...", headers: { "Server": "nginx/1.25.3" } },
    hardened: { status: 403, response: "Forbidden — path normalised and request denied.", headers: { "Server": "nginx" } },
    fix: `merge_slashes on;\nlocation ~ /\\.\\./ {\n  deny all;\n}`,
  },
  {
    id: "dotfiles",
    name: "Hidden File Exposure",
    severity: "high",
    description: "Accesses hidden configuration files like .env, .git/config containing secrets.",
    payload: "/.env",
    vulnerable: { status: 200, response: "DB_PASSWORD=supersecret123\nAPI_KEY=sk_live_abc...\nJWT_SECRET=...", headers: { "Server": "nginx/1.25.3" } },
    hardened: { status: 403, response: "Forbidden — all dotfile access denied.", headers: { "Server": "nginx" } },
    fix: `location ~ /\\. {\n  deny all;\n  access_log off;\n  log_not_found off;\n}`,
  },
  {
    id: "clickjacking",
    name: "Clickjacking",
    severity: "medium",
    description: "Embeds your site in an invisible iframe to trick users into clicking hidden elements.",
    payload: '<iframe src="https://target.com/transfer"></iframe>',
    vulnerable: { status: 200, response: "Site loads normally inside attacker's iframe.", headers: { "Server": "nginx/1.25.3" } },
    hardened: { status: 200, response: "Browser refuses to render page inside iframe.", headers: { "X-Frame-Options": "DENY", "Content-Security-Policy": "frame-ancestors 'none'" } },
    fix: `add_header X-Frame-Options "DENY" always;\nadd_header Content-Security-Policy "frame-ancestors 'none';" always;`,
  },
  {
    id: "ratelimit",
    name: "Rate Limiting / DDoS",
    severity: "medium",
    description: "Floods the server with requests to exhaust resources and cause denial of service.",
    payload: "for i in {1..1000}; do curl target; done",
    vulnerable: { status: 200, response: "All 1000 requests served. Server resources exhausted.", headers: { "Server": "nginx/1.25.3" } },
    hardened: { status: 429, response: "Too Many Requests — rate limit exceeded after burst threshold.", headers: { "Retry-After": "30", "Server": "nginx" } },
    fix: `limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;\n\nlocation /api/ {\n  limit_req zone=api burst=20 nodelay;\n}`,
  },
];

const requirementConfig = `server {
    listen 443 ssl http2;
    server_name example.com;

    # ✅ Mandatory TLS 1.3 only
    ssl_protocols TLSv1.3;
    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_session_tickets off;

    # ✅ Hide server version
    server_tokens off;

    # ✅ HSTS — strict transport security
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # ✅ CSP — content security policy
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; frame-ancestors 'none';" always;

    # ✅ X-Frame-Options — clickjacking protection
    add_header X-Frame-Options "DENY" always;

    # Reverse proxy to backend
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name example.com;
    return 301 https://$server_name$request_uri;
}`;

const requirements = [
  { label: "Nginx as Reverse Proxy", met: true, detail: "proxy_pass with X-Forwarded headers set" },
  { label: "Mandatory TLS 1.3", met: true, detail: "ssl_protocols TLSv1.3 — no legacy fallback" },
  { label: "HSTS Header", met: true, detail: "max-age=63072000 includeSubDomains preload" },
  { label: "Content-Security-Policy", met: true, detail: "default-src 'self'; frame-ancestors 'none'" },
  { label: "X-Frame-Options", met: true, detail: "DENY — blocks all iframe embedding" },
  { label: "HTTP → HTTPS Redirect", met: true, detail: "301 redirect on port 80" },
  { label: "Server Version Hidden", met: true, detail: "server_tokens off" },
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
              {/* Checklist */}
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

              {/* Config */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nginx Config</h4>
                  <button
                    onClick={() => { navigator.clipboard.writeText(requirementConfig); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
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
  const [copied, setCopied] = useState("");

  const runAttack = () => {
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      setResult({ vulnerable: attack.vulnerable, hardened: attack.hardened });
      setRunning(false);
      setExpanded(true);
    }, 800 + Math.random() * 600);
  };

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

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
              {/* Vulnerable */}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <X className="w-4 h-4 text-destructive" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-destructive">Vulnerable</span>
                  <Badge variant="outline" className="text-[10px] ml-auto border-destructive/30 text-destructive">
                    HTTP {result.vulnerable.status}
                  </Badge>
                </div>
                <div className="font-mono text-xs p-3 rounded-lg bg-destructive/5 border border-destructive/10 text-destructive/80 mb-3 whitespace-pre-wrap">
                  {result.vulnerable.response}
                </div>
                <div className="space-y-1">
                  {Object.entries(result.vulnerable.headers).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{k}:</span>
                      <span className="font-mono text-destructive/70">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hardened */}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">Hardened</span>
                  <Badge variant="outline" className="text-[10px] ml-auto border-primary/30 text-primary">
                    HTTP {result.hardened.status}
                  </Badge>
                </div>
                <div className="font-mono text-xs p-3 rounded-lg bg-primary/5 border border-primary/10 text-primary/80 mb-3 whitespace-pre-wrap">
                  {result.hardened.response}
                </div>
                <div className="space-y-1">
                  {Object.entries(result.hardened.headers).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{k}:</span>
                      <span className="font-mono text-primary/70">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Fix */}
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
  const [allRunning, setAllRunning] = useState(false);

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
              Fire lab probes and compare attack proxy vs safe proxy responses side by side.
            </p>
          </div>
        </div>

        {/* Requirement Check: Secure Proxy */}
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
