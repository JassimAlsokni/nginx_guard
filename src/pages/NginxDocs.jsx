import { motion } from "framer-motion";
import { FileText, Copy, Check } from "lucide-react";
import { useState } from "react";

const docs = [
  {
    title: "Reverse Proxy Basics",
    content: "A reverse proxy sits between clients and backend servers. Nginx receives client requests, forwards them to the appropriate backend, and returns the response. This provides load balancing, SSL termination, caching, and security.",
    config: `server {\n    listen 443 ssl;\n    server_name example.com;\n\n    location / {\n        proxy_pass http://backend:3000;\n        proxy_http_version 1.1;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n}`,
  },
  {
    title: "Location Blocks",
    content: "Location blocks define how Nginx handles requests for specific URI patterns. They support exact match (=), prefix match, and regex match (~). Order matters — Nginx picks the most specific match.",
    config: `# Exact match (highest priority)\nlocation = /health {\n    return 200 'OK';\n}\n\n# Prefix match\nlocation /api/ {\n    proxy_pass http://backend;\n}\n\n# Regex match\nlocation ~* \\.(js|css|png|jpg)$ {\n    expires 30d;\n    add_header Cache-Control "public, immutable";\n}`,
  },
  {
    title: "Rate Limiting",
    content: "Rate limiting protects against brute-force attacks and DDoS. Define a zone (shared memory) and apply limits per location. The burst parameter allows short traffic spikes without dropping requests.",
    config: `# Define zone: 10MB shared memory, 10 req/sec per IP\nlimit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;\n\nserver {\n    location /api/ {\n        limit_req zone=api burst=20 nodelay;\n        limit_req_status 429;\n    }\n}`,
  },
  {
    title: "Access Control",
    content: "Restrict access by IP address, HTTP method, or authentication. Block sensitive paths and limit which HTTP methods are allowed for each endpoint.",
    config: `# Block dotfiles (.env, .git, etc.)\nlocation ~ /\\. {\n    deny all;\n    access_log off;\n    log_not_found off;\n}\n\n# Restrict HTTP methods\nlocation /api/ {\n    limit_except GET POST HEAD {\n        deny all;\n    }\n}\n\n# IP allowlist\nlocation /admin/ {\n    allow 10.0.0.0/8;\n    deny all;\n}`,
  },
  {
    title: "Logging Configuration",
    content: "Nginx supports access logs and error logs with customizable formats. JSON log format is recommended for structured log analysis and integration with monitoring tools.",
    config: `log_format json_combined escape=json\n  '{"time":"$time_iso8601",'\n   '"remote_addr":"$remote_addr",'\n   '"request":"$request",'\n   '"status":$status,'\n   '"body_bytes_sent":$body_bytes_sent,'\n   '"request_time":$request_time,'\n   '"upstream_response_time":"$upstream_response_time"}';\n\naccess_log /var/log/nginx/access.log json_combined;\nerror_log /var/log/nginx/error.log warn;`,
  },
  {
    title: "Upstream Configuration",
    content: "Upstream blocks define groups of backend servers for load balancing. Nginx supports round-robin (default), least_conn, ip_hash, and weighted distribution.",
    config: `upstream backend {\n    least_conn;\n    server 127.0.0.1:3001 weight=3;\n    server 127.0.0.1:3002 weight=1;\n    server 127.0.0.1:3003 backup;\n\n    keepalive 32;\n}\n\nserver {\n    location / {\n        proxy_pass http://backend;\n    }\n}`,
  },
];

function DocCard({ doc, index }) {
  const [copied, setCopied] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl border border-border bg-card p-6"
    >
      <h3 className="text-base font-semibold text-foreground mb-3">{doc.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">{doc.content}</p>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Example</span>
          <button
            onClick={() => { navigator.clipboard.writeText(doc.config); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="font-mono text-xs p-4 rounded-lg bg-secondary/30 border border-border text-foreground/80 overflow-x-auto whitespace-pre-wrap">
          {doc.config}
        </pre>
      </div>
    </motion.div>
  );
}

export default function NginxDocs() {
  return (
    <div className="min-h-screen p-6 lg:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Nginx Reference</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-[52px] mb-8">
          Reverse proxy directives, patterns, and configuration reference.
        </p>

        <div className="space-y-4">
          {docs.map((doc, i) => (
            <DocCard key={doc.title} doc={doc} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}