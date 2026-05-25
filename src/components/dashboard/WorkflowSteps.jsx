import { motion } from "framer-motion";
import { Terminal, Shield, FileCode2, CheckCircle2 } from "lucide-react";

const steps = [
  { title: "Start", desc: "Bring up Docker, the scanner API, and the dev server.", icon: Terminal, color: "text-accent" },
  { title: "Baseline", desc: "Open the weak baseline and show missing headers.", icon: Shield, color: "text-destructive" },
  { title: "Fix", desc: "Edit Nginx config with the form builder, apply and reload.", icon: FileCode2, color: "text-chart-3" },
  { title: "Prove", desc: "Re-run scans and logs to show what changed.", icon: CheckCircle2, color: "text-primary" },
];

export default function WorkflowSteps() {
  return (
    <section className="px-6 py-16">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Presentation Flow</h2>
          <p className="text-muted-foreground">Follow this order when demonstrating to students.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative p-6 rounded-xl border border-border bg-card hover:border-primary/30 transition-all duration-300 group"
            >
              {/* Step number */}
              <div className="absolute top-4 right-4 text-[64px] font-extrabold text-foreground/[0.03] leading-none select-none">
                {i + 1}
              </div>

              <div className={`w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${step.color}`}>
                <step.icon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold mb-2 text-foreground">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}