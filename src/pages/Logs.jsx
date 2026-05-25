import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, FileClock, RefreshCw, ShieldCheck, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const views = [
  { key: "attack-access", label: "Attack Access", source: "attack", type: "access" },
  { key: "attack-error", label: "Attack Error", source: "attack", type: "error" },
  { key: "safe-access", label: "Safe Access", source: "safe", type: "access" },
  { key: "safe-error", label: "Safe Error", source: "safe", type: "error" },
  { key: "alerts", label: "Alerts", source: "alerts", type: "access" },
];

function statValue(value) {
  return Number(value || 0).toLocaleString();
}

function StatCard({ icon: Icon, label, value, tone = "default" }) {
  const toneClass =
    tone === "danger"
      ? "border-destructive/25 bg-destructive/5 text-destructive"
      : tone === "safe"
      ? "border-primary/25 bg-primary/5 text-primary"
      : "border-border bg-card text-foreground";

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider opacity-70">{label}</p>
          <p className="text-2xl font-bold mt-1">{statValue(value)}</p>
        </div>
        <Icon className="w-5 h-5 opacity-80" />
      </div>
    </div>
  );
}

function StatusCounts({ counts = {} }) {
  const entries = Object.entries(counts).sort(([a], [b]) => Number(a) - Number(b));

  if (!entries.length) {
    return <span className="text-xs text-muted-foreground">No status codes yet</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([status, count]) => (
        <Badge key={status} variant="outline" className="font-mono">
          {status}: {count}
        </Badge>
      ))}
    </div>
  );
}

function LogLine({ line }) {
  const suspicious = /(\/.env(?:[/?#]|$)|\/.git(?:[/?#]|$)|\.sql(?:[/?#]|$)|\.bak(?:[/?#]|$)|\.zip(?:[/?#]|$)|\/backup[/?#]|\/config[/?#]|\bunion\s+select\b|\bselect\s+.{0,50}?\s+from\b|\bor\s+1\s*=\s*1|information_schema|<script>|javascript:|onerror=|onload=|\.\.\/|\/admin|"POST \/login)/i.test(line);
  const blocked = /" (403|404) /.test(line);

  return (
    <div
      className={`rounded border px-3 py-2 font-mono text-[11px] leading-relaxed break-all ${
        suspicious
          ? blocked
            ? "border-primary/20 bg-primary/5 text-primary/90"
            : "border-destructive/20 bg-destructive/5 text-destructive/90"
          : "border-border bg-secondary/20 text-foreground/75"
      }`}
    >
      {line}
    </div>
  );
}

export default function Logs() {
  const [summary, setSummary] = useState(null);
  const [lines, setLines] = useState([]);
  const [activeView, setActiveView] = useState(views[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const latestFindings = useMemo(() => summary?.findings?.slice(0, 8) || [], [summary]);
  const latestAlerts = useMemo(() => summary?.alerts?.slice(0, 8) || [], [summary]);

  const loadData = async (view = activeView) => {
    setLoading(true);
    setError("");

    try {
      const [summaryResponse, logResponse] = await Promise.all([
        fetch("/api/lab/log-summary"),
        fetch(`/api/lab/logs?source=${view.source}&type=${view.type}&limit=200`),
      ]);

      const summaryPayload = await summaryResponse.json();
      const logPayload = await logResponse.json();

      if (!summaryResponse.ok || !summaryPayload.ok) {
        throw new Error(summaryPayload.error || "Could not load log summary");
      }

      if (!logResponse.ok || !logPayload.ok) {
        throw new Error(logPayload.error || "Could not load log lines");
      }

      setSummary(summaryPayload.summary);
      setLines(logPayload.lines || []);
    } catch (err) {
      setError(err.message);
      setSummary(null);
      setLines([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(activeView);
    const timer = setInterval(() => loadData(activeView), 5000);
    return () => clearInterval(timer);
  }, [activeView]);

  const selectView = (view) => {
    setActiveView(view);
    loadData(view);
  };

  return (
    <div className="min-h-screen p-6 lg:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileClock className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">Nginx Logs</h1>
            </div>
            <p className="text-sm text-muted-foreground ml-[52px]">
              Live view of attack, safe, and alert logs from the Docker lab.
            </p>
          </div>
          <Button onClick={() => loadData(activeView)} disabled={loading} className="gap-2 w-fit">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
            {error}. Start the local lab API with <span className="font-mono">npm run lab</span>.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <StatCard icon={ShieldOff} label="Attack Requests" value={summary?.attack?.totalRequests} tone="danger" />
          <StatCard icon={AlertTriangle} label="Attack Findings" value={summary?.attack?.suspiciousRequests} tone="danger" />
          <StatCard icon={ShieldCheck} label="Safe Blocks" value={summary?.safe?.blockedRequests} tone="safe" />
          <StatCard icon={Activity} label="Safe Requests" value={summary?.safe?.totalRequests} tone="safe" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-sm font-semibold mb-3">Attack Status Codes</h2>
            <StatusCounts counts={summary?.attack?.statusCounts} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-sm font-semibold mb-3">Safe Status Codes</h2>
            <StatusCounts counts={summary?.safe?.statusCounts} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-sm font-semibold mb-3">Latest Alerts</h2>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {latestAlerts.length ? latestAlerts.map((line, index) => <LogLine key={`${line}-${index}`} line={line} />) : <p className="text-xs text-muted-foreground">No alerts yet</p>}
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-border bg-card p-5 xl:col-span-1">
            <h2 className="text-sm font-semibold mb-4">Detected Findings</h2>
            <div className="space-y-3">
              {latestFindings.length ? (
                latestFindings.map((finding, index) => (
                  <div key={`${finding.raw}-${index}`} className="rounded-lg border border-border bg-secondary/20 p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Badge variant="outline" className={finding.severity === "High" ? "border-destructive/30 text-destructive" : "border-chart-3/30 text-chart-3"}>
                        {finding.severity}
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground">HTTP {finding.status || "?"}</span>
                    </div>
                    <p className="text-sm font-medium">{finding.type}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-1 break-all">{finding.request || finding.raw}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No suspicious findings yet</p>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-border bg-card xl:col-span-2 overflow-hidden">
            <div className="border-b border-border p-4">
              <div className="flex flex-wrap gap-2">
                {views.map((view) => (
                  <button
                    key={view.key}
                    onClick={() => selectView(view)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      activeView.key === view.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 space-y-2 max-h-[620px] overflow-y-auto">
              {lines.length ? (
                lines.map((line, index) => <LogLine key={`${line}-${index}`} line={line} />)
              ) : (
                <p className="text-sm text-muted-foreground p-4">No log lines yet</p>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
