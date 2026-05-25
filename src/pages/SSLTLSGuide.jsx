import { motion } from "framer-motion";
import { Lock, Shield, Copy, Check } from "lucide-react";
import { useState } from "react";

const sections = [
  {
    title: "TLS Protocol Versions",
    content: "Only TLS 1.2 and TLS 1.3 should be enabled. TLS 1.0 and 1.1 are deprecated and have known vulnerabilities. TLS 1.3 is faster (1-RTT handshake) and removes insecure cipher suites entirely.",
    config: `ssl_protocols TLSv1.2 TLSv1.3;`,
    tip: "If you only support modern clients, use TLS 1.3 exclusively for maximum security.",
  },
  {
    title: "Cipher Suites",
    content: "Strong cipher suites ensure encryption cannot be broken. Prefer AEAD ciphers (AES-GCM, ChaCha20) and ECDHE for forward secrecy. Disable weak ciphers like RC4, DES, and export-grade suites.",
    config: `ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305';\nssl_prefer_server_ciphers on;`,
    tip: "TLS 1.3 manages its own cipher suite selection — these settings only affect TLS 1.2.",
  },
  {
    title: "HSTS (HTTP Strict Transport Security)",
    content: "HSTS ensures browsers never attempt an insecure HTTP connection to your domain. After receiving the header, the browser automatically upgrades all requests to HTTPS for the specified duration.",
    config: `add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;`,
    tip: "Start with max-age=300 during testing, then increase to 2 years for production.",
  },
  {
    title: "Certificate Configuration",
    content: "Use certificates from a trusted CA like Let's Encrypt. Configure the full certificate chain for proper validation. Never commit certificates to version control.",
    config: `ssl_certificate /etc/nginx/ssl/fullchain.pem;\nssl_certificate_key /etc/nginx/ssl/privkey.pem;\nssl_trusted_certificate /etc/nginx/ssl/chain.pem;`,
    tip: "Automate renewal with certbot or similar tools. Certificates expire every 90 days.",
  },
  {
    title: "OCSP Stapling",
    content: "OCSP stapling allows Nginx to fetch and cache certificate revocation status, improving TLS handshake performance and user privacy (clients don't need to contact the CA directly).",
    config: `ssl_stapling on;\nssl_stapling_verify on;\nresolver 8.8.8.8 8.8.4.4 valid=300s;\nresolver_timeout 5s;`,
    tip: "Verify OCSP is working: openssl s_client -connect domain:443 -status",
  },
  {
    title: "Session Configuration",
    content: "TLS session resumption speeds up repeat connections. Disable session tickets (they can weaken forward secrecy) and use a shared session cache instead.",
    config: `ssl_session_cache shared:SSL:10m;\nssl_session_timeout 1d;\nssl_session_tickets off;`,
    tip: "Disabling session tickets ensures forward secrecy is maintained even if server keys are compromised.",
  },
  {
    title: "HTTP to HTTPS Redirect",
    content: "Always redirect HTTP traffic to HTTPS. This ensures users who type your domain without https:// are automatically secured.",
    config: `server {\n  listen 80;\n  server_name example.com;\n  return 301 https://$server_name$request_uri;\n}`,
    tip: "Use 301 (permanent) redirect so browsers cache it and skip the HTTP request on future visits.",
  },
];

function SectionCard({ section, index }) {
  const [copied, setCopied] = useState(false);

  const copyConfig = () => {
    navigator.clipboard.writeText(section.config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl border border-border bg-card p-6"
    >
      <h3 className="text-base font-semibold text-foreground mb-3">{section.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">{section.content}</p>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Config</span>
          <button onClick={copyConfig} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="font-mono text-xs p-4 rounded-lg bg-secondary/30 border border-border text-foreground/80 overflow-x-auto whitespace-pre-wrap">
          {section.config}
        </pre>
      </div>

      <div className="flex gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
        <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-primary/80 leading-relaxed">{section.tip}</p>
      </div>
    </motion.div>
  );
}

export default function SSLTLSGuide() {
  return (
    <div className="min-h-screen p-6 lg:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">SSL / TLS Guide</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-[52px] mb-8">
          TLS configuration, certificates, ciphers, HSTS, and deployment best practices.
        </p>

        <div className="space-y-4">
          {sections.map((section, i) => (
            <SectionCard key={section.title} section={section} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}