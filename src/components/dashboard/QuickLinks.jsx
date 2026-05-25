import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Zap, Settings, Shield, Lock, FileText, Terminal, ArrowUpRight, FileClock } from "lucide-react";

const tools = [
  { title: "Attack Simulator", desc: "Classroom walkthrough of proxy behavior.", icon: Zap, path: "/attack-simulator", tone: "border-primary/20 hover:border-primary/40" },
  { title: "Config Generator", desc: "Build hardened reverse proxy configs interactively.", icon: Settings, path: "/config-generator", tone: "border-accent/20 hover:border-accent/40" },
  { title: "Nginx Logs", desc: "Inspect real attack, safe, and alert log files.", icon: FileClock, path: "/logs", tone: "border-primary/20 hover:border-primary/40" },
  { title: "Security Headers", desc: "Reference for every required browser security header.", icon: Shield, path: "/security-headers", tone: "border-chart-3/20 hover:border-chart-3/40" },
  { title: "SSL/TLS Guide", desc: "Certificates, ciphers, HSTS, and deployment notes.", icon: Lock, path: "/ssl-tls-guide", tone: "border-chart-5/20 hover:border-chart-5/40" },
  { title: "Nginx Reference", desc: "Reverse proxy directives and lab config reference.", icon: FileText, path: "/nginx-docs", tone: "border-destructive/20 hover:border-destructive/40" },
  { title: "Test Commands", desc: "Validated curl commands with expected outputs.", icon: Terminal, path: "/command-tests", tone: "border-muted-foreground/20 hover:border-muted-foreground/40" },
];

export default function QuickLinks() {
  return (
    <section className="px-6 py-16 border-t border-border/50">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Tools & Guides</h2>
          <p className="text-muted-foreground">Everything you need to build, test, and learn.</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool, i) => (
            <motion.div
              key={tool.path}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                to={tool.path}
                className={`block p-5 rounded-xl border bg-card ${tool.tone} transition-all duration-300 group`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-secondary/50 flex items-center justify-center">
                    <tool.icon className="w-4 h-4 text-foreground" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{tool.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{tool.desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
