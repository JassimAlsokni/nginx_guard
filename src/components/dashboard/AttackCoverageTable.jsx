import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

const attacks = [
  { name: "Sensitive Paths", vulnerable: "Allowed and logged", hardened: "403 before app", fix: "location block" },
  { name: "Missing Headers", vulnerable: "Headers absent", hardened: "Required headers present", fix: "add_header" },
  { name: "TLS Config", vulnerable: "HTTP only", hardened: "TLS 1.3 only", fix: "ssl_protocols TLSv1.3" },
  { name: "HTTP Redirect", vulnerable: "No redirect", hardened: "8082 redirects to 8443", fix: "301 redirect" },
  { name: "SQLi-Looking Requests", vulnerable: "Logged for review", hardened: "Logged for review", fix: "log analysis" },
  { name: "XSS-Looking Requests", vulnerable: "Logged for review", hardened: "CSP header present", fix: "CSP + monitoring" },
  { name: "Directory Traversal", vulnerable: "Logged for review", hardened: "Logged or blocked by path policy", fix: "log analysis" },
  { name: "Login Bursts", vulnerable: "POST /login logged", hardened: "POST /login logged", fix: "brute-force analysis" },
];

export default function AttackCoverageTable() {
  return (
    <section className="px-6 py-16">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Attack Coverage</h2>
          <p className="text-muted-foreground">The same frontend app is tested through the attack proxy and the safe proxy.</p>
        </motion.div>

        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/30 border-b border-border">
              <tr>
                <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-foreground">Test Area</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-destructive">Attack Proxy</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-primary">Safe Proxy</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Key Fix</th>
              </tr>
            </thead>
            <tbody>
              {attacks.map((a, i) => (
                <motion.tr
                  key={a.name}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/50 hover:bg-secondary/20 transition-colors"
                >
                  <td className="px-5 py-3.5 font-medium text-foreground">{a.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 text-destructive">
                      <X className="w-3.5 h-3.5" />
                      <span className="text-destructive/80">{a.vulnerable}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 text-primary">
                      <Check className="w-3.5 h-3.5" />
                      <span className="text-primary/80">{a.hardened}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <code className="text-xs font-mono px-2 py-1 rounded bg-secondary/50 text-muted-foreground">{a.fix}</code>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
