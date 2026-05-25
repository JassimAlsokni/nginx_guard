import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Copy, Check, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const defaultOptions = {
  serverName: "example.com",
  backendUrl: "http://127.0.0.1:3000",
  listenPort: "443",
  enableSSL: true,
  enableHSTS: true,
  enableCSP: true,
  enableXFrameOptions: true,
  enableXContentType: true,
  enableReferrerPolicy: true,
  enablePermissionsPolicy: true,
  hideServerTokens: true,
  enableRateLimit: true,
  enableDotfileBlock: true,
  enableGzip: true,
};

function generateConfig(opts) {
  const lines = [];
  
  if (opts.enableRateLimit) {
    lines.push("limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;");
    lines.push("");
  }

  if (opts.enableSSL) {
    lines.push("server {");
    lines.push("    listen 80;");
    lines.push(`    server_name ${opts.serverName};`);
    lines.push(`    return 301 https://$server_name$request_uri;`);
    lines.push("}");
    lines.push("");
  }

  lines.push("server {");
  
  if (opts.enableSSL) {
    lines.push(`    listen ${opts.listenPort} ssl http2;`);
    lines.push(`    server_name ${opts.serverName};`);
    lines.push("");
    lines.push("    # TLS Configuration");
    lines.push("    ssl_certificate /etc/nginx/ssl/fullchain.pem;");
    lines.push("    ssl_certificate_key /etc/nginx/ssl/privkey.pem;");
    lines.push("    ssl_protocols TLSv1.3;");
    lines.push("    # TLS 1.3 selects modern ciphers automatically.");
    lines.push("    ssl_session_cache shared:SSL:10m;");
    lines.push("    ssl_session_timeout 1d;");
    lines.push("    ssl_session_tickets off;");
  } else {
    lines.push(`    listen ${opts.listenPort || "80"};`);
    lines.push(`    server_name ${opts.serverName};`);
  }

  if (opts.hideServerTokens) {
    lines.push("");
    lines.push("    # Hide server version");
    lines.push("    server_tokens off;");
  }

  const headerLines = [];
  if (opts.enableHSTS) headerLines.push('    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;');
  if (opts.enableCSP) headerLines.push("    add_header Content-Security-Policy \"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-ancestors 'none';\" always;");
  if (opts.enableXFrameOptions) headerLines.push('    add_header X-Frame-Options "DENY" always;');
  if (opts.enableXContentType) headerLines.push('    add_header X-Content-Type-Options "nosniff" always;');
  if (opts.enableReferrerPolicy) headerLines.push('    add_header Referrer-Policy "strict-origin-when-cross-origin" always;');
  if (opts.enablePermissionsPolicy) headerLines.push('    add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(), usb=()" always;');

  if (headerLines.length) {
    lines.push("");
    lines.push("    # Security Headers");
    lines.push(...headerLines);
  }

  if (opts.enableDotfileBlock) {
    lines.push("");
    lines.push("    # Block dotfiles");
    lines.push("    location ~ /\\. {");
    lines.push("        deny all;");
    lines.push("        access_log off;");
    lines.push("        log_not_found off;");
    lines.push("    }");
  }

  if (opts.enableGzip) {
    lines.push("");
    lines.push("    # Gzip compression");
    lines.push("    gzip on;");
    lines.push("    gzip_types text/plain text/css application/json application/javascript text/xml;");
    lines.push("    gzip_min_length 256;");
  }

  lines.push("");
  lines.push("    location / {");
  if (opts.enableRateLimit) {
    lines.push("        limit_req zone=api burst=20 nodelay;");
  }
  lines.push(`        proxy_pass ${opts.backendUrl};`);
  lines.push("        proxy_http_version 1.1;");
  lines.push('        proxy_set_header Host $host;');
  lines.push('        proxy_set_header X-Real-IP $remote_addr;');
  lines.push('        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;');
  lines.push('        proxy_set_header X-Forwarded-Proto $scheme;');
  lines.push("    }");
  lines.push("}");

  return lines.join("\n");
}

export default function ConfigGenerator() {
  const [options, setOptions] = useState(defaultOptions);
  const [copied, setCopied] = useState(false);

  const config = generateConfig(options);

  const update = (key, value) => setOptions((prev) => ({ ...prev, [key]: value }));

  const copyConfig = () => {
    navigator.clipboard.writeText(config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadConfig = () => {
    const blob = new Blob([config], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nginx-${options.serverName}.conf`;
    a.click();
  };

  const toggles = [
    { key: "enableSSL", label: "SSL / TLS" },
    { key: "enableHSTS", label: "HSTS" },
    { key: "enableCSP", label: "Content-Security-Policy" },
    { key: "enableXFrameOptions", label: "X-Frame-Options" },
    { key: "enableXContentType", label: "X-Content-Type-Options" },
    { key: "enableReferrerPolicy", label: "Referrer-Policy" },
    { key: "enablePermissionsPolicy", label: "Permissions-Policy" },
    { key: "hideServerTokens", label: "Hide Server Tokens" },
    { key: "enableRateLimit", label: "Rate Limiting" },
    { key: "enableDotfileBlock", label: "Block Dotfiles" },
    { key: "enableGzip", label: "Gzip Compression" },
  ];

  return (
    <div className="min-h-screen p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Config Generator</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-[52px] mb-8">
          Build hardened Nginx reverse proxy configurations interactively.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Server Settings</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Server Name</Label>
                  <Input value={options.serverName} onChange={(e) => update("serverName", e.target.value)} className="mt-1 font-mono text-sm bg-secondary/30" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Backend URL</Label>
                  <Input value={options.backendUrl} onChange={(e) => update("backendUrl", e.target.value)} className="mt-1 font-mono text-sm bg-secondary/30" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Listen Port</Label>
                  <Input value={options.listenPort} onChange={(e) => update("listenPort", e.target.value)} className="mt-1 font-mono text-sm bg-secondary/30" />
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Security Features</h3>
                <button onClick={() => setOptions(defaultOptions)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              </div>
              {toggles.map((toggle) => (
                <div key={toggle.key} className="flex items-center justify-between py-1.5">
                  <Label className="text-sm text-muted-foreground cursor-pointer">{toggle.label}</Label>
                  <Switch checked={options[toggle.key]} onCheckedChange={(v) => update(toggle.key, v)} />
                </div>
              ))}
            </motion.div>
          </div>

          {/* Output */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-3 rounded-xl border border-border bg-card overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/20">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Generated Config</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={copyConfig} className="text-xs gap-1.5 h-7">
                  {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
                <Button size="sm" variant="ghost" onClick={downloadConfig} className="text-xs gap-1.5 h-7">
                  <Download className="w-3 h-3" /> Download
                </Button>
              </div>
            </div>
            <pre className="p-5 font-mono text-xs text-foreground/80 overflow-x-auto leading-relaxed min-h-[400px]">
              {config}
            </pre>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
