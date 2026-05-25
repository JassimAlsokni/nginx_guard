import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Play, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const attackTests = [
  {
    id: "sqli",
    name: "SQL Injection",
    severity: "critical",
    curlCmd: `curl -k -s -o /dev/null -w "%{http_code}" \\\n  'https://localhost:8443/search?q=UNION%20SELECT%20username,password%20FROM%20users'`,
    attackCmd: `curl -s 'http://localhost:8081/search?q=UNION%20SELECT%20username,password%20FROM%20users'`,
    safeCmd: `curl -k -s 'https://localhost:8443/search?q=UNION%20SELECT%20username,password%20FROM%20users'`,
  },
  {
    id: "xss",
    name: "Reflected XSS",
    severity: "high",
    curlCmd: `curl -k -s -D - 'https://localhost:8443/search?q=%3Cscript%3Ealert(1)%3C/script%3E' \\\n  | grep -E "content-security|x-content|HTTP"`,
    attackCmd: `curl -s 'http://localhost:8081/search?q=<script>alert(1)</script>'`,
    safeCmd: `curl -k -s -D - 'https://localhost:8443/search?q=<script>alert(1)</script>'`,
  },
  {
    id: "path-traversal",
    name: "Directory Traversal",
    severity: "critical",
    curlCmd: `curl.exe -kI https://localhost:8443/etc/passwd`,
    attackCmd: `curl.exe -I http://localhost:8081/etc/passwd`,
    safeCmd: `curl.exe -kI https://localhost:8443/etc/passwd`,
  },
  {
    id: "dotfiles",
    name: "Dotfile / Secret Path",
    severity: "high",
    curlCmd: `curl -k -s -o /dev/null -w "%{http_code}" https://localhost:8443/.env\ncurl -k -s -o /dev/null -w "%{http_code}" https://localhost:8443/.git/config`,
    attackCmd: `curl -s http://localhost:8081/.env`,
    safeCmd: `curl -k -s https://localhost:8443/.env`,
  },
  {
    id: "git-config",
    name: "Git Config Path",
    severity: "high",
    curlCmd: `curl.exe -kI https://localhost:8443/.git/config`,
    attackCmd: `curl.exe -I http://localhost:8081/.git/config`,
    safeCmd: `curl.exe -kI https://localhost:8443/.git/config`,
  },
  {
    id: "backup-sql",
    name: "SQL Backup File",
    severity: "high",
    curlCmd: `curl.exe -kI https://localhost:8443/backup.sql`,
    attackCmd: `curl.exe -I http://localhost:8081/backup.sql`,
    safeCmd: `curl.exe -kI https://localhost:8443/backup.sql`,
  },
  {
    id: "backup-zip",
    name: "ZIP Backup File",
    severity: "high",
    curlCmd: `curl.exe -kI https://localhost:8443/backup.zip`,
    attackCmd: `curl.exe -I http://localhost:8081/backup.zip`,
    safeCmd: `curl.exe -kI https://localhost:8443/backup.zip`,
  },
  {
    id: "admin",
    name: "Admin Path Probe",
    severity: "medium",
    curlCmd: `curl.exe -kI https://localhost:8443/admin`,
    attackCmd: `curl.exe -I http://localhost:8081/admin`,
    safeCmd: `curl.exe -kI https://localhost:8443/admin`,
  },
  {
    id: "clickjacking",
    name: "Clickjacking Headers",
    severity: "medium",
    curlCmd: `curl.exe -kI https://localhost:8443`,
    attackCmd: `curl.exe -I http://localhost:8081`,
    safeCmd: `curl.exe -kI https://localhost:8443`,
  },
  {
    id: "https-proof",
    name: "HTTPS Proof",
    severity: "critical",
    curlCmd: `curl.exe -kI https://localhost:8443`,
    attackCmd: `curl.exe -kI https://localhost:8081`,
    safeCmd: `curl.exe -kI https://localhost:8443`,
  },
  {
    id: "redirect-proof",
    name: "HTTP Redirect Proof",
    severity: "high",
    curlCmd: `curl.exe -I http://localhost:8082`,
    attackCmd: `curl.exe -I http://localhost:8081`,
    safeCmd: `curl.exe -I http://localhost:8082`,
  },
  {
    id: "attack-http-proof",
    name: "Attack HTTP Proof",
    severity: "high",
    curlCmd: `curl.exe -I http://localhost:8081`,
    attackCmd: `curl.exe -I http://localhost:8081`,
    safeCmd: `curl.exe -kI https://localhost:8443`,
  },
  {
    id: "csp-header",
    name: "CSP Header Proof",
    severity: "high",
    curlCmd: `curl.exe -kI https://localhost:8443`,
    attackCmd: `curl.exe -I http://localhost:8081`,
    safeCmd: `curl.exe -kI https://localhost:8443`,
  },
  {
    id: "hsts-header",
    name: "HSTS Header Proof",
    severity: "high",
    curlCmd: `curl.exe -kI https://localhost:8443`,
    attackCmd: `curl.exe -I http://localhost:8081`,
    safeCmd: `curl.exe -kI https://localhost:8443`,
  },
  {
    id: "xframe-header",
    name: "X-Frame-Options Proof",
    severity: "medium",
    curlCmd: `curl.exe -kI https://localhost:8443`,
    attackCmd: `curl.exe -I http://localhost:8081`,
    safeCmd: `curl.exe -kI https://localhost:8443`,
  },
  {
    id: "xcontent-header",
    name: "X-Content-Type-Options Proof",
    severity: "medium",
    curlCmd: `curl.exe -kI https://localhost:8443`,
    attackCmd: `curl.exe -I http://localhost:8081`,
    safeCmd: `curl.exe -kI https://localhost:8443`,
  },
  {
    id: "referrer-header",
    name: "Referrer-Policy Proof",
    severity: "medium",
    curlCmd: `curl.exe -kI https://localhost:8443`,
    attackCmd: `curl.exe -I http://localhost:8081`,
    safeCmd: `curl.exe -kI https://localhost:8443`,
  },
  {
    id: "permissions-header",
    name: "Permissions-Policy Proof",
    severity: "medium",
    curlCmd: `curl.exe -kI https://localhost:8443`,
    attackCmd: `curl.exe -I http://localhost:8081`,
    safeCmd: `curl.exe -kI https://localhost:8443`,
  },
  {
    id: "ratelimit",
    name: "Login Attempt Logging",
    severity: "medium",
    curlCmd: `for i in {1..50}; do\n  curl -k -s -o /dev/null -w "req $i: %{http_code}\\n" \\\n    -X POST https://localhost:8443/login\ndone`,
    attackCmd: `for i in {1..50}; do curl -s -o /dev/null -w "req $i: %{http_code}\\n" -X POST http://localhost:8081/login; done`,
    safeCmd: `for i in {1..50}; do curl -k -s -o /dev/null -w "req $i: %{http_code}\\n" -X POST https://localhost:8443/login; done`,
  },
  {
    id: "tls",
    name: "TLS Protocol Check",
    severity: "critical",
    curlCmd: `openssl s_client -connect localhost:8443 -tls1_3`,
    attackCmd: `curl -I http://localhost:8081`,
    safeCmd: `openssl s_client -connect localhost:8443 -tls1_3`,
  },
  {
    id: "tls13-only",
    name: "TLS 1.3 Proof",
    severity: "critical",
    curlCmd: `openssl s_client -connect localhost:8443 -tls1_3`,
    attackCmd: `curl.exe -I http://localhost:8081`,
    safeCmd: `openssl s_client -connect localhost:8443 -tls1_3`,
  },
  {
    id: "tls12-rejected",
    name: "TLS 1.2 Rejection Proof",
    severity: "critical",
    curlCmd: `openssl s_client -connect localhost:8443 -tls1_2`,
    attackCmd: `curl.exe -I http://localhost:8081`,
    safeCmd: `openssl s_client -connect localhost:8443 -tls1_2`,
  },
  {
    id: "headers",
    name: "Security Headers Audit",
    severity: "high",
    curlCmd: `curl -k -s -D - https://localhost:8443 -o /dev/null \\\n  | grep -iE "strict|content-security|x-frame|x-content|referrer|permissions"`,
    attackCmd: `curl -s -D - http://localhost:8081 -o /dev/null`,
    safeCmd: `curl -k -s -D - https://localhost:8443 -o /dev/null`,
  },
];

const severityColors = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function OutputLine({ text }) {
  const value = String(text ?? "");
  const isWarning = value.startsWith("WARN:") || value.startsWith("ERROR:");
  const isSuccess = value.startsWith("PASS:");
  const isHttp = value.startsWith("HTTP/");

  return (
    <div
      className={
        isWarning
          ? "text-destructive/90"
          : isSuccess
          ? "text-primary/90"
          : isHttp
          ? "text-accent font-semibold"
          : "text-foreground/70"
      }
    >
      {value || "\u00A0"}
    </div>
  );
}

function TerminalOutput({ label, cmd, testId, target, isAttack }) {
  const [running, setRunning] = useState(false);
  const [shown, setShown] = useState(false);
  const [output, setOutput] = useState("");
  const [displayedLines, setDisplayedLines] = useState([]);
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const playOutput = (text) => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const nextOutput = String(text ?? "");
    setOutput(nextOutput);
    setShown(true);
    setDisplayedLines([]);

    const lines = nextOutput.split("\n");
    let i = 0;

    intervalRef.current = setInterval(() => {
      const nextLine = lines[i];
      if (nextLine === undefined) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setRunning(false);
        return;
      }

      setDisplayedLines((prev) => [...prev, nextLine]);
      i += 1;

      if (i >= lines.length) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setRunning(false);
      }
    }, 35);
  };

  const run = async () => {
    if (running) return;

    setRunning(true);
    setShown(true);
    setOutput("");
    setDisplayedLines(["Running real local check..."]);

    try {
      const response = await fetch("/api/lab/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, target }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || `Lab API returned HTTP ${response.status}`);
      }

      playOutput(payload.output || "No output returned from lab API.");
    } catch (error) {
      playOutput(
        [
          `ERROR: ${error.message}`,
          "",
          "This button performs a real local run through /api/lab/run.",
          "Start the lab with:",
          "docker compose up --build -d",
        ].join("\n")
      );
    }
  };

  const copy = () => {
    copyToClipboard(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const borderColor = isAttack ? "border-destructive/30" : "border-primary/30";
  const bgColor = isAttack ? "bg-destructive/5" : "bg-primary/5";
  const labelColor = isAttack ? "text-destructive" : "text-primary";

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} overflow-hidden`}>
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${borderColor} bg-black/20`}>
        <span className={`text-xs font-semibold uppercase tracking-wider ${labelColor}`}>{label}</span>
        <div className="flex items-center gap-2">
          <button onClick={copy} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={run}
            disabled={running}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              isAttack
                ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
                : "bg-primary/20 text-primary hover:bg-primary/30"
            } disabled:opacity-50`}
          >
            {running ? (
              <div className="w-2.5 h-2.5 border border-current/30 border-t-current rounded-full animate-spin" />
            ) : (
              <Play className="w-2.5 h-2.5" />
            )}
            {running ? "Running" : "Run"}
          </button>
        </div>
      </div>

      <div className="px-4 pt-3 pb-1">
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground text-xs font-mono mt-0.5 select-none">$</span>
          <pre className="font-mono text-xs text-foreground/75 overflow-x-auto whitespace-pre-wrap flex-1">{cmd}</pre>
        </div>
      </div>

      <div className="px-4 pb-4 min-h-[96px]">
        {!shown && !running && (
          <p className="text-xs text-muted-foreground/60 font-mono mt-2 italic">Press Run to execute a real check.</p>
        )}
        {(running || shown) && (
          <div className="mt-2 rounded-lg border border-border bg-black/20 p-3 font-mono text-xs leading-relaxed overflow-x-auto">
            {displayedLines.map((line, index) => (
              <OutputLine key={`${line}-${index}`} text={line} />
            ))}
            {running && <span className="inline-block w-2 h-3.5 bg-foreground/50 animate-pulse ml-0.5" />}
          </div>
        )}
      </div>
    </div>
  );
}

function AttackTestCard({ test, index }) {
  const [open, setOpen] = useState(false);
  const [copiedMain, setCopiedMain] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-lg border border-border bg-card overflow-hidden"
    >
      <button
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-secondary/20 transition-colors"
      >
        <h3 className="flex-1 text-sm font-semibold text-foreground">{test.name}</h3>
        <Badge variant="outline" className={`text-[10px] ${severityColors[test.severity]}`}>
          {test.severity}
        </Badge>
        <span className={`text-xs text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}>v</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-border">
              <div className="py-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Quick Test Command
                  </span>
                  <button
                    onClick={() => {
                      copyToClipboard(test.curlCmd);
                      setCopiedMain(true);
                      setTimeout(() => setCopiedMain(false), 1600);
                    }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {copiedMain ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
                    {copiedMain ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="font-mono text-xs p-3 rounded-lg bg-secondary/30 border border-border text-foreground/80 overflow-x-auto whitespace-pre-wrap">
                  {test.curlCmd}
                </pre>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TerminalOutput
                  label="Attack Proxy - port 8081"
                  cmd={test.attackCmd}
                  testId={test.id}
                  target="attack"
                  isAttack
                />
                <TerminalOutput
                  label="Safe Proxy - port 8443"
                  cmd={test.safeCmd}
                  testId={test.id}
                  target="safe"
                  isAttack={false}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function CommandTests() {
  return (
    <div className="min-h-screen p-6 lg:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Terminal className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Live Attack Command Tests</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-[52px] mb-8">
          Open a test, then press Run. Each box calls the real lab API and writes to the Docker Nginx logs.
        </p>

        <div className="space-y-3">
          {attackTests.map((test, index) => (
            <AttackTestCard key={test.id} test={test} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
