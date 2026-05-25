import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Lock, Eye, AlertTriangle, FileWarning, Server, Monitor, Frame, Copy, Check, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const headers = [
  {
    title: "Strict-Transport-Security (HSTS)",
    icon: Lock,
    severity: "critical",
    description: "Tells browsers to always use HTTPS. After the first visit, the browser refuses HTTP connections, preventing protocol downgrade attacks.",
    directives: [
      { name: "max-age=63072000", desc: "2 years. Browser remembers to use HTTPS." },
      { name: "includeSubDomains", desc: "Applies to all subdomains." },
      { name: "preload", desc: "Submit to HSTS Preload List built into browsers." },
    ],
    config: `add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;`,
    warning: "Once preloaded, removal takes months. Start with a shorter max-age for testing.",
  },
  {
    title: "Content-Security-Policy (CSP)",
    icon: Shield,
    severity: "critical",
    description: "The most powerful security header. Defines which content sources are allowed, providing strong XSS defense.",
    directives: [
      { name: "default-src 'self'", desc: "Fallback for all resource types." },
      { name: "script-src 'self'", desc: "Controls script execution. Avoid 'unsafe-inline'." },
      { name: "style-src 'self' 'unsafe-inline'", desc: "Controls stylesheets." },
      { name: "frame-ancestors 'none'", desc: "Replaces X-Frame-Options." },
    ],
    config: `add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-ancestors 'none';" always;`,
    warning: "Deploy with Content-Security-Policy-Report-Only first to identify issues.",
  },
  {
    title: "X-Frame-Options",
    icon: Frame,
    severity: "high",
    description: "Prevents your page from being embedded in iframes, defending against clickjacking attacks.",
    directives: [
      { name: "DENY", desc: "Page cannot be iframed at all." },
      { name: "SAMEORIGIN", desc: "Only same-origin framing allowed." },
    ],
    config: `add_header X-Frame-Options "DENY" always;`,
    warning: "Being replaced by CSP frame-ancestors. Use both for compatibility.",
  },
  {
    title: "X-Content-Type-Options",
    icon: FileWarning,
    severity: "medium",
    description: "Prevents MIME-type sniffing which can turn non-executable content into executable, leading to XSS.",
    directives: [
      { name: "nosniff", desc: "The only valid value. Stops content-type guessing." },
    ],
    config: `add_header X-Content-Type-Options "nosniff" always;`,
    warning: null,
  },
  {
    title: "Referrer-Policy",
    icon: Eye,
    severity: "medium",
    description: "Controls how much referrer information is sent with requests. Protects privacy and prevents leaking sensitive URLs.",
    directives: [
      { name: "no-referrer", desc: "Never send referrer. Most private." },
      { name: "strict-origin-when-cross-origin", desc: "Recommended default." },
    ],
    config: `add_header Referrer-Policy "strict-origin-when-cross-origin" always;`,
    warning: null,
  },
  {
    title: "Permissions-Policy",
    icon: Monitor,
    severity: "low",
    description: "Controls which browser features and APIs the page can use. Replaces Feature-Policy.",
    directives: [
      { name: "geolocation=()", desc: "Disable geolocation." },
      { name: "microphone=()", desc: "Disable microphone." },
      { name: "camera=()", desc: "Disable camera." },
    ],
    config: `add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(), usb=()" always;`,
    warning: "Only disable features you don't need.",
  },
  {
    title: "Server Version Hiding",
    icon: Server,
    severity: "low",
    description: "Hides Nginx version from Server header, reducing fingerprinting for automated CVE matching.",
    directives: [
      { name: "server_tokens off", desc: "Removes version from Server header." },
    ],
    config: `server_tokens off;`,
    warning: "Hardening only — still keep Nginx updated.",
  },
];

const severityMap = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

function HeaderCard({ header, index }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyConfig = () => {
    navigator.clipboard.writeText(header.config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl border border-border bg-card overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-secondary/20 transition-colors"
      >
        <div className="w-9 h-9 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0">
          <header.icon className="w-4 h-4 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">{header.title}</h3>
            <Badge variant="outline" className={`text-[10px] ${severityMap[header.severity]}`}>
              {header.severity}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{header.description}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border overflow-hidden"
          >
            <div className="p-5 space-y-5">
              <p className="text-sm text-muted-foreground leading-relaxed">{header.description}</p>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Directives</h4>
                <div className="space-y-2">
                  {header.directives.map((d) => (
                    <div key={d.name} className="flex gap-3 text-sm">
                      <code className="font-mono text-xs px-2 py-0.5 rounded bg-secondary/50 text-primary flex-shrink-0 h-fit">{d.name}</code>
                      <span className="text-muted-foreground text-xs">{d.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nginx Config</h4>
                  <button onClick={copyConfig} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <pre className="font-mono text-xs p-4 rounded-lg bg-secondary/30 border border-border text-foreground/80 overflow-x-auto whitespace-pre-wrap">
                  {header.config}
                </pre>
              </div>

              {header.warning && (
                <div className="flex gap-3 p-3 rounded-lg bg-chart-3/5 border border-chart-3/20">
                  <AlertTriangle className="w-4 h-4 text-chart-3 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-chart-3/80 leading-relaxed">{header.warning}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function SecurityHeaders() {
  return (
    <div className="min-h-screen p-6 lg:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Security Headers Guide</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-[52px] mb-8">
          Deep-dive into each HTTP security header for Nginx hardening.
        </p>

        <div className="p-5 rounded-xl border border-accent/20 bg-accent/5 mb-8">
          <p className="text-sm text-accent/90 leading-relaxed">
            Security headers instruct browsers to enable built-in security mechanisms. They form a critical layer of defense against XSS, clickjacking, protocol downgrade, and data injection attacks. With Nginx, always include the <code className="font-mono text-xs bg-accent/10 px-1.5 py-0.5 rounded">always</code> directive to send headers on all response codes.
          </p>
        </div>

        <div className="space-y-3">
          {headers.map((header, i) => (
            <HeaderCard key={header.title} header={header} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}